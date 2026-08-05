import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { WRITE_HISTORY_PROPS } from "./schema";
import type { BlogCategory } from "@/lib/write/blogCategories";
import type { StylePreset, FontChoice } from "@/lib/write/blogTheme";

// AI 글쓰기 히스토리(`/write/history`, 2026-08 추가, 사용자 요청 — "게시에
// 적용한 글들을 히스토리로 저장하고, 그걸 기반으로 앞으로 스타일을 미리
// 정해줬으면"). "이 버전으로 확정하기" 클릭 시점에 1건씩 쌓임 — 작성자는
// board.ts와 동일하게 relation이 아니라 작성 시점 ID·닉네임 스냅샷.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function dataSourceId(): string {
  return requireEnv("NOTION_WRITE_HISTORY_DB_ID");
}

export interface WriteHistoryEntry {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorNickname: string;
  category: BlogCategory;
  sponsored: boolean;
  tags: string[];
  stylePreset: StylePreset | null;
  layout: string;
  accentColor: string | null;
  font: FontChoice | null;
  createdAt: string;
}

// Notion rich_text 속성의 개별 text 객체는 2000자를 넘으면 400 에러가 남
// (§CLAUDE.md에서 여러 번 언급된 제약). 블로그 본문은 최소 1500자 이상이라
// 거의 항상 이 한도에 걸리므로, 배열 안에 2000자 이하 청크 여러 개로 나눠
// 담는다(속성 하나에 rich_text 객체 최대 100개까지 허용되므로 충분).
const RICH_TEXT_CHUNK_SIZE = 2000;

function toChunkedRichText(text: string): { type: "text"; text: { content: string } }[] {
  if (!text) return [];
  const chunks: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += RICH_TEXT_CHUNK_SIZE) {
    chunks.push({ type: "text", text: { content: text.slice(i, i + RICH_TEXT_CHUNK_SIZE) } });
  }
  return chunks;
}

function richText(prop: PageObjectResponse["properties"][string] | undefined): string {
  return prop?.type === "rich_text" ? prop.rich_text.map((t) => t.plain_text).join("") : "";
}

function selectValue(prop: PageObjectResponse["properties"][string] | undefined): string | null {
  return prop?.type === "select" ? (prop.select?.name ?? null) : null;
}

function parseWriteHistoryEntry(page: PageObjectResponse): WriteHistoryEntry {
  const props = page.properties;
  const titleProp = props[WRITE_HISTORY_PROPS.title];
  const title = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  const sponsoredProp = props[WRITE_HISTORY_PROPS.sponsored];
  const sponsored = sponsoredProp?.type === "checkbox" ? sponsoredProp.checkbox : false;

  const tagsRaw = richText(props[WRITE_HISTORY_PROPS.tags]);
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const createdAtProp = props[WRITE_HISTORY_PROPS.createdAt];
  const createdAt = createdAtProp?.type === "created_time" ? createdAtProp.created_time : "";

  const accentColor = richText(props[WRITE_HISTORY_PROPS.accentColor]) || null;

  return {
    id: page.id,
    title,
    body: richText(props[WRITE_HISTORY_PROPS.body]),
    authorId: richText(props[WRITE_HISTORY_PROPS.authorId]),
    authorNickname: richText(props[WRITE_HISTORY_PROPS.authorNickname]),
    category: (selectValue(props[WRITE_HISTORY_PROPS.category]) ?? "") as BlogCategory,
    sponsored,
    tags,
    stylePreset: selectValue(props[WRITE_HISTORY_PROPS.stylePreset]) as StylePreset | null,
    layout: selectValue(props[WRITE_HISTORY_PROPS.layout]) ?? "표준형",
    accentColor,
    font: selectValue(props[WRITE_HISTORY_PROPS.font]) as FontChoice | null,
    createdAt,
  };
}

export async function createWriteHistoryEntry(input: {
  title: string;
  body: string;
  authorId: string;
  authorNickname: string;
  category: BlogCategory;
  sponsored: boolean;
  tags: string[];
  stylePreset: StylePreset | null;
  layout: string;
  accentColor: string | null;
  font: FontChoice | null;
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId() },
    properties: {
      [WRITE_HISTORY_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: input.title } }] },
      [WRITE_HISTORY_PROPS.body]: { type: "rich_text", rich_text: toChunkedRichText(input.body) },
      [WRITE_HISTORY_PROPS.authorId]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorId } }],
      },
      [WRITE_HISTORY_PROPS.authorNickname]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorNickname } }],
      },
      [WRITE_HISTORY_PROPS.category]: { type: "select", select: { name: input.category } },
      [WRITE_HISTORY_PROPS.sponsored]: { type: "checkbox", checkbox: input.sponsored },
      [WRITE_HISTORY_PROPS.tags]: {
        type: "rich_text",
        rich_text: input.tags.length ? [{ type: "text", text: { content: input.tags.join(", ") } }] : [],
      },
      [WRITE_HISTORY_PROPS.stylePreset]: {
        type: "select",
        select: input.stylePreset ? { name: input.stylePreset } : null,
      },
      [WRITE_HISTORY_PROPS.layout]: { type: "select", select: { name: input.layout } },
      [WRITE_HISTORY_PROPS.accentColor]: {
        type: "rich_text",
        rich_text: input.accentColor ? [{ type: "text", text: { content: input.accentColor } }] : [],
      },
      [WRITE_HISTORY_PROPS.font]: { type: "select", select: input.font ? { name: input.font } : null },
    },
  });
  return page.id;
}

// 로그인한 본인의 과거 적용 글 목록(`/write/history`)과, 새 글 생성 시 문체
// 참고용 최근 글 조회(blogWriter.ts) 양쪽에서 재사용. category를 주면 같은
// 유형으로 좁혀서 찾고(문체 참고용 — 유형마다 톤이 크게 달라서), 없으면
// 전체에서 최신순.
export async function getWriteHistoryForUser(
  authorId: string,
  options: { category?: BlogCategory; limit?: number } = {}
): Promise<WriteHistoryEntry[]> {
  const { category, limit = 20 } = options;
  const filter = category
    ? {
        and: [
          { property: WRITE_HISTORY_PROPS.authorId, rich_text: { equals: authorId } },
          { property: WRITE_HISTORY_PROPS.category, select: { equals: category } },
        ],
      }
    : { property: WRITE_HISTORY_PROPS.authorId, rich_text: { equals: authorId } };

  const res = await notion.dataSources.query({
    data_source_id: dataSourceId(),
    filter,
    sorts: [{ property: WRITE_HISTORY_PROPS.createdAt, direction: "descending" }],
    page_size: limit,
  });
  return res.results.filter(isFullPage).map(parseWriteHistoryEntry);
}
