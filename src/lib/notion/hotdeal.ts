import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { HOTDEAL_POST_PROPS, HOTDEAL_COMMENT_PROPS, HOTDEAL_SOURCE } from "./schema";

export type HotdealSourceValue = (typeof HOTDEAL_SOURCE)[keyof typeof HOTDEAL_SOURCE];
import {
  createThreadedComment,
  getThreadedCommentsForPost,
  type ThreadedComment,
} from "./threadedComments";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function postsDataSourceId(): string {
  return requireEnv("NOTION_HOTDEAL_POSTS_DB_ID");
}

function commentsDataSourceId(): string {
  return requireEnv("NOTION_HOTDEAL_COMMENTS_DB_ID");
}

export interface PriceEntry {
  platform: string;
  price: number;
  url: string;
}

export interface HotdealPost {
  id: string;
  title: string;
  body: string;
  modelName: string;
  authorNickname: string;
  authorId: string;
  comparisons: PriceEntry[];
  lowestPrice: number | null;
  source: HotdealSourceValue | "";
  sourceId: string;
  thumbnailUrl: string;
  postedAt: string;
  commentCount: number;
}

function richText(value: PageObjectResponse["properties"][string] | undefined): string {
  return value?.type === "rich_text" ? value.rich_text.map((t) => t.plain_text).join("") : "";
}

// comparisons는 JSON 문자열로 저장됨(rich_text) — 손상된 값이 있어도 화면이
// 깨지지 않도록 파싱 실패 시 빈 배열로 처리.
function parseComparisons(raw: string): PriceEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is PriceEntry =>
          e && typeof e.platform === "string" && typeof e.price === "number" && typeof e.url === "string"
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

function parseHotdealPost(page: PageObjectResponse): HotdealPost {
  const props = page.properties;
  const titleProp = props[HOTDEAL_POST_PROPS.title];
  const title = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  const lowestPriceProp = props[HOTDEAL_POST_PROPS.lowestPrice];
  const lowestPrice = lowestPriceProp?.type === "number" ? lowestPriceProp.number : null;

  const postedAtProp = props[HOTDEAL_POST_PROPS.postedAt];
  const postedAt = postedAtProp?.type === "date" ? postedAtProp.date?.start ?? "" : "";

  const commentCountProp = props[HOTDEAL_POST_PROPS.commentCount];
  const commentCount = commentCountProp?.type === "relation" ? commentCountProp.relation.length : 0;

  const sourceProp = props[HOTDEAL_POST_PROPS.source];
  const source = sourceProp?.type === "select" ? (sourceProp.select?.name as HotdealSourceValue) ?? "" : "";

  const thumbnailProp = props[HOTDEAL_POST_PROPS.thumbnailUrl];
  const thumbnailUrl = thumbnailProp?.type === "url" ? thumbnailProp.url ?? "" : "";

  return {
    id: page.id,
    title,
    body: richText(props[HOTDEAL_POST_PROPS.body]),
    modelName: richText(props[HOTDEAL_POST_PROPS.modelName]),
    authorNickname: richText(props[HOTDEAL_POST_PROPS.authorNickname]),
    authorId: richText(props[HOTDEAL_POST_PROPS.authorId]),
    comparisons: parseComparisons(richText(props[HOTDEAL_POST_PROPS.comparisons])),
    lowestPrice,
    source,
    sourceId: richText(props[HOTDEAL_POST_PROPS.sourceId]),
    thumbnailUrl,
    postedAt,
    commentCount,
  };
}

// 회원이 직접 상품명·가격비교·구매링크를 입력해 등록(§CLAUDE.md 신규 섹션 —
// 11번가·쿠팡파트너스 API가 사업자 전용이라 자동화 대신 이 방식으로 전환).
// 최저가는 서버에서 comparisons로부터 계산(클라이언트 값을 그대로 믿지
// 않음). hotdealCrawlJob.ts(루리웹 RSS 자동 수집)도 이 함수를 그대로 재사용
// — source/sourceId를 넘기면 자동수집 글로 표시되고 dedup 대상이 됨.
export async function createHotdealPost(input: {
  title: string;
  body: string;
  modelName: string;
  authorNickname: string;
  authorId: string;
  comparisons: PriceEntry[];
  source?: HotdealSourceValue;
  sourceId?: string;
  thumbnailUrl?: string;
}): Promise<string> {
  const lowestPrice = input.comparisons.length > 0 ? Math.min(...input.comparisons.map((c) => c.price)) : null;

  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: postsDataSourceId() },
    properties: {
      [HOTDEAL_POST_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: input.title } }] },
      [HOTDEAL_POST_PROPS.body]: { type: "rich_text", rich_text: [{ type: "text", text: { content: input.body } }] },
      [HOTDEAL_POST_PROPS.modelName]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.modelName } }],
      },
      [HOTDEAL_POST_PROPS.authorNickname]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorNickname } }],
      },
      [HOTDEAL_POST_PROPS.authorId]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorId } }],
      },
      [HOTDEAL_POST_PROPS.comparisons]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: JSON.stringify(input.comparisons) } }],
      },
      [HOTDEAL_POST_PROPS.lowestPrice]: { type: "number", number: lowestPrice },
      [HOTDEAL_POST_PROPS.source]: { type: "select", select: { name: input.source ?? HOTDEAL_SOURCE.member } },
      [HOTDEAL_POST_PROPS.sourceId]: {
        type: "rich_text",
        rich_text: input.sourceId ? [{ type: "text", text: { content: input.sourceId } }] : [],
      },
      [HOTDEAL_POST_PROPS.thumbnailUrl]: { type: "url", url: input.thumbnailUrl || null },
      [HOTDEAL_POST_PROPS.postedAt]: { type: "date", date: { start: new Date().toISOString() } },
    },
  });
  return page.id;
}

// 2026-08 추가(사용자 요청 — 요약·구매링크 상품정보 기능을 붙이기 전에 이미
// 올라와 있던 자동수집 글들을 뒤늦게 채워 넣는 백필용, scripts/backfill-hotdeal-crawled-details.ts).
// createHotdealPost와 달리 부분 업데이트만 하고 postedAt/source 등은 안 건드림.
export async function updateHotdealPost(
  id: string,
  input: {
    body?: string;
    comparisons?: PriceEntry[];
    thumbnailUrl?: string;
    authorNickname?: string;
    authorId?: string;
  }
): Promise<void> {
  const properties: Parameters<typeof notion.pages.update>[0]["properties"] = {};
  if (input.body !== undefined) {
    properties[HOTDEAL_POST_PROPS.body] = {
      type: "rich_text",
      rich_text: input.body ? [{ type: "text", text: { content: input.body } }] : [],
    };
  }
  if (input.comparisons !== undefined) {
    properties[HOTDEAL_POST_PROPS.comparisons] = {
      type: "rich_text",
      rich_text: [{ type: "text", text: { content: JSON.stringify(input.comparisons) } }],
    };
    const lowestPrice = input.comparisons.length > 0 ? Math.min(...input.comparisons.map((c) => c.price)) : null;
    properties[HOTDEAL_POST_PROPS.lowestPrice] = { type: "number", number: lowestPrice };
  }
  if (input.authorNickname !== undefined) {
    properties[HOTDEAL_POST_PROPS.authorNickname] = {
      type: "rich_text",
      rich_text: input.authorNickname ? [{ type: "text", text: { content: input.authorNickname } }] : [],
    };
  }
  if (input.authorId !== undefined) {
    properties[HOTDEAL_POST_PROPS.authorId] = {
      type: "rich_text",
      rich_text: input.authorId ? [{ type: "text", text: { content: input.authorId } }] : [],
    };
  }
  if (input.thumbnailUrl !== undefined) {
    properties[HOTDEAL_POST_PROPS.thumbnailUrl] = { type: "url", url: input.thumbnailUrl || null };
  }
  await notion.pages.update({ page_id: id, properties });
}

// 루리웹 RSS를 매일 다시 훑을 때 이미 게시한 글을 중복 게시하지 않기 위한
// dedup 체크 — policyBoard.ts의 findPolicyPostBySourceId와 동일한 패턴.
export async function findHotdealPostBySourceId(sourceId: string): Promise<boolean> {
  const res = await notion.dataSources.query({
    data_source_id: postsDataSourceId(),
    filter: { property: HOTDEAL_POST_PROPS.sourceId, rich_text: { equals: sourceId } },
    page_size: 1,
  });
  return res.results.length > 0;
}

export async function getHotdealPost(id: string): Promise<HotdealPost | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (!isFullPage(page) || page.archived) return null;
    return parseHotdealPost(page);
  } catch {
    return null;
  }
}

const PAGE_SIZE = 20;

export async function getHotdealPosts(
  cursor?: string,
  modelSearch?: string
): Promise<{ posts: HotdealPost[]; nextCursor: string | null }> {
  const res = await notion.dataSources.query({
    data_source_id: postsDataSourceId(),
    filter: modelSearch
      ? { property: HOTDEAL_POST_PROPS.modelName, rich_text: { contains: modelSearch } }
      : undefined,
    sorts: [{ property: HOTDEAL_POST_PROPS.postedAt, direction: "descending" }],
    start_cursor: cursor,
    page_size: PAGE_SIZE,
  });
  return {
    posts: res.results.filter(isFullPage).map(parseHotdealPost),
    nextCursor: res.has_more ? (res.next_cursor ?? null) : null,
  };
}

// /mypage의 "핫딜정보 내 게시물" — 회원등록 글만 걸림(자동수집 글은
// authorId가 전용 표시계정 고정값이라, 특정 회원 개인의 mypage에는 안 뜨는
// 게 맞는 동작).
export async function getHotdealPostsByAuthor(authorId: string): Promise<HotdealPost[]> {
  const posts: HotdealPost[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: postsDataSourceId(),
      filter: { property: HOTDEAL_POST_PROPS.authorId, rich_text: { equals: authorId } },
      sorts: [{ property: HOTDEAL_POST_PROPS.postedAt, direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    posts.push(...res.results.filter(isFullPage).map(parseHotdealPost));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return posts;
}

export async function createHotdealComment(input: {
  postId: string;
  content: string;
  authorNickname: string;
  parentCommentId?: string | null;
}): Promise<string> {
  return createThreadedComment(commentsDataSourceId(), HOTDEAL_COMMENT_PROPS, input);
}

export async function getCommentsForHotdealPost(postId: string): Promise<ThreadedComment[]> {
  return getThreadedCommentsForPost(commentsDataSourceId(), HOTDEAL_COMMENT_PROPS, HOTDEAL_COMMENT_PROPS.post, postId);
}
