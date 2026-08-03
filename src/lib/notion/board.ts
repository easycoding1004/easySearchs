import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { BOARD_POST_PROPS, BOARD_COMMENT_PROPS } from "./schema";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function postsDataSourceId(): string {
  return requireEnv("NOTION_BOARD_POSTS_DB_ID");
}

function commentsDataSourceId(): string {
  return requireEnv("NOTION_BOARD_COMMENTS_DB_ID");
}

export interface BoardPost {
  id: string;
  title: string;
  body: string;
  authorNickname: string;
  authorId: string;
  createdAt: string;
}

export interface BoardComment {
  id: string;
  content: string;
  authorNickname: string;
  createdAt: string;
}

function richText(value: PageObjectResponse["properties"][string]): string {
  return value?.type === "rich_text" ? value.rich_text.map((t) => t.plain_text).join("") : "";
}

// 표시일시(date, 사람이 쓸 수 있음)가 있으면 그걸 우선하고, 없으면(이 속성을
// 추가하기 전에 만들어진 글) Notion 내장 작성일시(created_time)로 폴백함.
function resolveDisplayDate(
  props: PageObjectResponse["properties"],
  postedAtKey: string,
  createdAtKey: string
): string {
  const postedProp = props[postedAtKey];
  if (postedProp?.type === "date" && postedProp.date?.start) return postedProp.date.start;
  const createdProp = props[createdAtKey];
  return createdProp?.type === "created_time" ? createdProp.created_time : "";
}

function parseBoardPost(page: PageObjectResponse): BoardPost {
  const props = page.properties;
  const titleProp = props[BOARD_POST_PROPS.title];
  const title = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  return {
    id: page.id,
    title,
    body: richText(props[BOARD_POST_PROPS.body]),
    authorNickname: richText(props[BOARD_POST_PROPS.authorNickname]),
    authorId: richText(props[BOARD_POST_PROPS.authorId]),
    createdAt: resolveDisplayDate(props, BOARD_POST_PROPS.postedAt, BOARD_POST_PROPS.createdAt),
  };
}

function parseBoardComment(page: PageObjectResponse): BoardComment {
  const props = page.properties;
  const titleProp = props[BOARD_COMMENT_PROPS.title];
  const content = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  return {
    id: page.id,
    content,
    authorNickname: richText(props[BOARD_COMMENT_PROPS.authorNickname]),
    createdAt: resolveDisplayDate(props, BOARD_COMMENT_PROPS.postedAt, BOARD_COMMENT_PROPS.createdAt),
  };
}

// files는 [{ type: "file_upload", file_upload: { id }, name }] 형태로 이미
// Notion에 업로드된 파일들의 id를 그대로 붙여넣는다(실제 업로드는
// boardImageUpload.ts가 먼저 수행) — 업로드 순서가 본문의 [이미지N] 토큰
// 순서와 그대로 대응함(1부터 시작).
export async function createBoardPost(input: {
  title: string;
  body: string;
  authorNickname: string;
  authorId: string;
  imageUploadIds: string[];
  // 시드/이관용 — 실제 사용자 작성 흐름에서는 안 넘기고 항상 현재 시각으로
  // 채워짐(BOARD_POST_PROPS.postedAt 주석 참고).
  postedAt?: string;
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: postsDataSourceId() },
    properties: {
      [BOARD_POST_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: input.title } }] },
      [BOARD_POST_PROPS.body]: { type: "rich_text", rich_text: [{ type: "text", text: { content: input.body } }] },
      [BOARD_POST_PROPS.authorNickname]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorNickname } }],
      },
      [BOARD_POST_PROPS.authorId]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorId } }],
      },
      [BOARD_POST_PROPS.images]: {
        type: "files",
        files: input.imageUploadIds.map((id, i) => ({
          type: "file_upload" as const,
          file_upload: { id },
          name: `image-${i + 1}`,
        })),
      },
      [BOARD_POST_PROPS.postedAt]: { type: "date", date: { start: input.postedAt ?? new Date().toISOString() } },
    },
  });
  return page.id;
}

export async function getBoardPost(id: string): Promise<BoardPost | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    // 삭제(소프트 삭제, archived:true — deleteBoardPost 참고)된 글은 조회
    // 자체는 성공하지만 존재하지 않는 것처럼 취급해야 함.
    if (!isFullPage(page) || page.archived) return null;
    return parseBoardPost(page);
  } catch {
    return null;
  }
}

export async function updateBoardPost(id: string, input: { title: string; body: string }): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: {
      [BOARD_POST_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: input.title } }] },
      [BOARD_POST_PROPS.body]: { type: "rich_text", rich_text: [{ type: "text", text: { content: input.body } }] },
    },
  });
}

// 실제 삭제 대신 archived:true(휴지통)로 소프트 삭제 — 이 사이트의 다른
// "삭제" 기능(구독 해지 등)과 같은 패턴. 게시글 목록/조회 쿼리는 Notion이
// 기본적으로 archived 페이지를 걸러주므로 별도 필터가 필요 없음.
export async function deleteBoardPost(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}

// 목록 — 최신순, 페이지당 20개. Notion 커서를 그대로 노출해서 "더 보기"에
// 씀(전체 개수를 세지 않음 — 검색 세션 등 다른 목록도 카운트가 필요 없는
// 곳은 굳이 전체를 훑지 않는 것과 동일한 절약).
const PAGE_SIZE = 20;

export async function getBoardPosts(
  cursor?: string
): Promise<{ posts: BoardPost[]; nextCursor: string | null }> {
  const res = await notion.dataSources.query({
    data_source_id: postsDataSourceId(),
    sorts: [{ property: BOARD_POST_PROPS.postedAt, direction: "descending" }],
    start_cursor: cursor,
    page_size: PAGE_SIZE,
  });
  return {
    posts: res.results.filter(isFullPage).map(parseBoardPost),
    nextCursor: res.has_more ? (res.next_cursor ?? null) : null,
  };
}

export async function createComment(input: {
  postId: string;
  content: string;
  authorNickname: string;
  // 시드/이관용 — BOARD_POST_PROPS.postedAt과 같은 이유·같은 패턴.
  postedAt?: string;
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: commentsDataSourceId() },
    properties: {
      [BOARD_COMMENT_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: input.content } }] },
      [BOARD_COMMENT_PROPS.authorNickname]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorNickname } }],
      },
      [BOARD_COMMENT_PROPS.post]: { type: "relation", relation: [{ id: input.postId }] },
      [BOARD_COMMENT_PROPS.postedAt]: { type: "date", date: { start: input.postedAt ?? new Date().toISOString() } },
    },
  });
  return page.id;
}

export async function getCommentsForPost(postId: string): Promise<BoardComment[]> {
  const comments: BoardComment[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: commentsDataSourceId(),
      filter: { property: BOARD_COMMENT_PROPS.post, relation: { contains: postId } },
      sorts: [{ property: BOARD_COMMENT_PROPS.postedAt, direction: "ascending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    comments.push(...res.results.filter(isFullPage).map(parseBoardComment));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return comments;
}

// 이미지 프록시 라우트(§CLAUDE.md 16 게시판 항목 참고)가 매 요청마다 이
// 페이지를 다시 조회해 그 순간 유효한 Notion 파일 URL을 얻는다 — Notion
// 호스팅 파일 URL은 1시간짜리 임시 URL이라 캐시/정적 참조 금지(공식 문서
// 확인).
export async function getBoardPostImageUrl(postId: string, index: number): Promise<string | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: postId });
    if (!isFullPage(page)) return null;
    const imagesProp = page.properties[BOARD_POST_PROPS.images];
    if (imagesProp?.type !== "files") return null;
    const file = imagesProp.files[index];
    if (!file) return null;
    // 실측/공식 문서 확인 — 업로드 시점엔 "file_upload" 타입으로 붙이지만,
    // 붙인 뒤 페이지를 다시 읽으면 항상 "file"(Notion 호스팅) 타입으로
    // 내려온다(SDK 타입도 읽기 쪽엔 file_upload가 없음).
    if (file.type === "file") return file.file.url;
    return null;
  } catch {
    return null;
  }
}
