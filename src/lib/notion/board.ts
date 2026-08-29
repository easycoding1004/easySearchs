import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { BOARD_POST_PROPS, BOARD_COMMENT_PROPS } from "./schema";
import { createTtlCache } from "../utils/ttlCache";

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
  commentCount: number;
  isNotice: boolean;
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

  const commentCountProp = props[BOARD_POST_PROPS.commentCount];
  const commentCount = commentCountProp?.type === "relation" ? commentCountProp.relation.length : 0;

  const noticeProp = props[BOARD_POST_PROPS.isNotice];
  const isNotice = noticeProp?.type === "checkbox" ? noticeProp.checkbox : false;

  return {
    id: page.id,
    title,
    body: richText(props[BOARD_POST_PROPS.body]),
    authorNickname: richText(props[BOARD_POST_PROPS.authorNickname]),
    authorId: richText(props[BOARD_POST_PROPS.authorId]),
    createdAt: resolveDisplayDate(props, BOARD_POST_PROPS.postedAt, BOARD_POST_PROPS.createdAt),
    commentCount,
    isNotice,
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
  // 2026-08 추가 — 공지 여부(§CLAUDE.md 18.5). 실제 글쓰기 폼에는 노출 안
  // 하고(회원이 스스로 공지를 달 수 있으면 안 되므로) 관리자용 스크립트에서만 씀.
  isNotice?: boolean;
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
      [BOARD_POST_PROPS.isNotice]: { type: "checkbox", checkbox: input.isNotice ?? false },
    },
  });
  return page.id;
}

// 관리자가 특정 글을 공지로 지정/해제 — 일반 글쓰기 흐름에는 없음(회원이
// 스스로 공지를 달 수 있으면 안 되므로 §CLAUDE.md 18.5 참고).
export async function setBoardPostNotice(id: string, isNotice: boolean): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: { [BOARD_POST_PROPS.isNotice]: { type: "checkbox", checkbox: isNotice } },
  });
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
export const BOARD_PAGE_SIZE = 20;
const PAGE_SIZE = BOARD_PAGE_SIZE;

// 공지(isNotice=true)는 여기서 제외 — getPinnedBoardPosts()가 별도로,
// 페이지네이션과 무관하게 항상 상단에 보여줌. 안 빼면 공지가 상단에도
// 뜨고 자기 순번이 왔을 때 목록에도 또 뜨는 중복이 생김.
export async function getBoardPosts(
  cursor?: string
): Promise<{ posts: BoardPost[]; nextCursor: string | null }> {
  const res = await notion.dataSources.query({
    data_source_id: postsDataSourceId(),
    filter: { property: BOARD_POST_PROPS.isNotice, checkbox: { equals: false } },
    sorts: [{ property: BOARD_POST_PROPS.postedAt, direction: "descending" }],
    start_cursor: cursor,
    page_size: PAGE_SIZE,
  });
  return {
    posts: res.results.filter(isFullPage).map(parseBoardPost),
    nextCursor: res.has_more ? (res.next_cursor ?? null) : null,
  };
}

// 목록 상단에 페이지네이션과 무관하게 항상 고정 노출되는 공지 — 개수가
// 적을 걸로 예상해 페이지네이션 없이 한 번에 다 가져옴.
export async function getPinnedBoardPosts(): Promise<BoardPost[]> {
  const res = await notion.dataSources.query({
    data_source_id: postsDataSourceId(),
    filter: { property: BOARD_POST_PROPS.isNotice, checkbox: { equals: true } },
    sorts: [{ property: BOARD_POST_PROPS.postedAt, direction: "descending" }],
    page_size: 20,
  });
  return res.results.filter(isFullPage).map(parseBoardPost);
}

// 2026-08 유입 전략 — sitemap에 게시판 개별 글을 등재하기 위한 전체 목록
// (공지 포함). id·작성/표시일시만 필요해서 가볍고, sitemap이 요청마다
// 재생성되므로 1시간 TTL 캐시로 Notion 재조회를 막음.
const SITEMAP_POSTS_CACHE_TTL_MS = 60 * 60 * 1000;
const sitemapPostsCache = createTtlCache<string, { id: string; createdAt: string }[]>(
  SITEMAP_POSTS_CACHE_TTL_MS
);

export async function getAllBoardPostsForSitemap(): Promise<{ id: string; createdAt: string }[]> {
  const cached = sitemapPostsCache.get("all");
  if (cached) return cached;

  const entries: { id: string; createdAt: string }[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: postsDataSourceId(),
      sorts: [{ property: BOARD_POST_PROPS.postedAt, direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results.filter(isFullPage)) {
      const post = parseBoardPost(page);
      entries.push({ id: post.id, createdAt: post.createdAt });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  sitemapPostsCache.set("all", entries);
  return entries;
}

// 주간 키워드 리포트 잡(weeklyReportJob.ts)의 중복 발행 가드 — 같은 제목
// 접두사를 가진 가장 최근 글 1건을 찾음. 서버 재배포가 잦아도 부팅 시마다
// 이 가드로 "마지막 발행이 7일 이내면 건너뛰기"가 가능해짐(뉴스레터 잡의
// 알려진 트레이드오프 §6.4를 피하는 패턴).
export async function findLatestBoardPostByTitlePrefix(prefix: string): Promise<BoardPost | null> {
  const res = await notion.dataSources.query({
    data_source_id: postsDataSourceId(),
    filter: { property: BOARD_POST_PROPS.title, title: { contains: prefix } },
    sorts: [{ property: BOARD_POST_PROPS.postedAt, direction: "descending" }],
    page_size: 1,
  });
  const page = res.results.filter(isFullPage)[0];
  return page ? parseBoardPost(page) : null;
}

// /mypage의 "게시판 내 게시물" — 작성자ID는 원래 §18.2에서 "나중에 '내 글만
// 보기' 등을 붙일 수 있도록" 남겨둔 필드였음(2026-08, 이제 실제로 씀).
export async function getBoardPostsByAuthor(authorId: string): Promise<BoardPost[]> {
  const posts: BoardPost[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: postsDataSourceId(),
      filter: { property: BOARD_POST_PROPS.authorId, rich_text: { equals: authorId } },
      sorts: [{ property: BOARD_POST_PROPS.postedAt, direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    posts.push(...res.results.filter(isFullPage).map(parseBoardPost));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return posts;
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
