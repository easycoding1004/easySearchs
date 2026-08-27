import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { KEYWORD_WATCH_PROPS } from "./schema";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function watchesDataSourceId(): string {
  return requireEnv("NOTION_KEYWORD_WATCHES_DB_ID");
}

export interface KeywordWatch {
  pageId: string;
  keyword: string;
  authorId: string;
  baselineCount: number;
  lastNotifiedCount: number | null;
  lastNotifiedAt: string; // ISO, "" if never notified
  createdAt: string; // ISO
}

function parseKeywordWatch(page: PageObjectResponse): KeywordWatch {
  const props = page.properties;

  const titleProp = props[KEYWORD_WATCH_PROPS.title];
  const keyword = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  const authorProp = props[KEYWORD_WATCH_PROPS.authorId];
  const authorId = authorProp?.type === "rich_text" ? authorProp.rich_text.map((t) => t.plain_text).join("") : "";

  const baselineProp = props[KEYWORD_WATCH_PROPS.baselineCount];
  const baselineCount = baselineProp?.type === "number" ? baselineProp.number ?? 0 : 0;

  const lastNotifiedCountProp = props[KEYWORD_WATCH_PROPS.lastNotifiedCount];
  const lastNotifiedCount = lastNotifiedCountProp?.type === "number" ? lastNotifiedCountProp.number : null;

  const lastNotifiedAtProp = props[KEYWORD_WATCH_PROPS.lastNotifiedAt];
  const lastNotifiedAt = lastNotifiedAtProp?.type === "date" ? lastNotifiedAtProp.date?.start ?? "" : "";

  const createdAtProp = props[KEYWORD_WATCH_PROPS.createdAt];
  const createdAt = createdAtProp?.type === "date" ? createdAtProp.date?.start ?? "" : "";

  return { pageId: page.id, keyword, authorId, baselineCount, lastNotifiedCount, lastNotifiedAt, createdAt };
}

// 같은 회원이 같은 키워드를 두 번 등록해도 새 행을 또 만들지 않음 —
// subscribers.ts의 findByEmail과 같은 이유(중복 방지, 중복 알림 방지).
async function findExisting(authorId: string, keyword: string): Promise<KeywordWatch | null> {
  const res = await notion.dataSources.query({
    data_source_id: watchesDataSourceId(),
    filter: {
      and: [
        { property: KEYWORD_WATCH_PROPS.authorId, rich_text: { equals: authorId } },
        { property: KEYWORD_WATCH_PROPS.title, title: { equals: keyword } },
      ],
    },
    page_size: 1,
  });
  const page = res.results.find(isFullPage);
  return page ? parseKeywordWatch(page) : null;
}

export async function createKeywordWatch(
  authorId: string,
  keyword: string,
  baselineCount: number
): Promise<KeywordWatch> {
  const existing = await findExisting(authorId, keyword);
  if (existing) return existing;

  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: watchesDataSourceId() },
    properties: {
      [KEYWORD_WATCH_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: keyword } }] },
      [KEYWORD_WATCH_PROPS.authorId]: { type: "rich_text", rich_text: [{ type: "text", text: { content: authorId } }] },
      [KEYWORD_WATCH_PROPS.baselineCount]: { type: "number", number: baselineCount },
      [KEYWORD_WATCH_PROPS.createdAt]: { type: "date", date: { start: new Date().toISOString() } },
    },
  });
  return parseKeywordWatch(page as PageObjectResponse);
}

export async function getKeywordWatchesByAuthor(authorId: string): Promise<KeywordWatch[]> {
  const watches: KeywordWatch[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: watchesDataSourceId(),
      filter: { property: KEYWORD_WATCH_PROPS.authorId, rich_text: { equals: authorId } },
      sorts: [{ property: KEYWORD_WATCH_PROPS.createdAt, direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    watches.push(...res.results.filter(isFullPage).map(parseKeywordWatch));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return watches;
}

// keywordWatchJob.ts가 매일 전체를 훑는 용도 — 관심 키워드 등록자 수가
// 뉴스레터 구독자보다도 훨씬 적을 것으로 예상돼(개인이 몇 개씩만 등록)
// subscribers.ts의 getAllSubscribers()처럼 페이지네이션만으로 충분함.
export async function getAllKeywordWatches(): Promise<KeywordWatch[]> {
  const watches: KeywordWatch[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: watchesDataSourceId(),
      start_cursor: cursor,
      page_size: 100,
    });
    watches.push(...res.results.filter(isFullPage).map(parseKeywordWatch));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return watches;
}

export async function recordKeywordWatchNotified(pageId: string, count: number): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [KEYWORD_WATCH_PROPS.lastNotifiedCount]: { type: "number", number: count },
      [KEYWORD_WATCH_PROPS.lastNotifiedAt]: { type: "date", date: { start: new Date().toISOString() } },
    },
  });
}

// 소유자 확인은 호출부(API 라우트)가 authorId 비교로 먼저 해야 함 — 이
// 함수는 이미 검증된 pageId만 받는다고 가정.
export async function deleteKeywordWatch(pageId: string): Promise<void> {
  await notion.pages.update({ page_id: pageId, archived: true });
}
