import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { SESSION_PROPS } from "./schema";
import type { SearchSession } from "./types";
import { countRowsMatching } from "./queryHelpers";
import { kstDayRangeUtcIso } from "../utils/formatDate";
import { createTtlCache } from "../utils/ttlCache";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function sessionsDataSourceId(): string {
  return requireEnv("NOTION_SESSIONS_DB_ID");
}

function parseSession(page: PageObjectResponse): SearchSession {
  const props = page.properties;

  const titleProp = props[SESSION_PROPS.title];
  const title =
    titleProp?.type === "title"
      ? titleProp.title.map((t) => t.plain_text).join("")
      : "";

  const keywordProp = props[SESSION_PROPS.keyword];
  const keyword =
    keywordProp?.type === "rich_text"
      ? keywordProp.rich_text.map((t) => t.plain_text).join("")
      : "";

  const dateProp = props[SESSION_PROPS.searchedAt];
  const searchedAt =
    dateProp?.type === "date" ? dateProp.date?.start ?? "" : "";

  const countProp = props[SESSION_PROPS.resultCount];
  const resultCount = countProp?.type === "number" ? countProp.number ?? 0 : 0;

  const authorIdProp = props[SESSION_PROPS.authorId];
  const authorId = authorIdProp?.type === "rich_text" ? authorIdProp.rich_text.map((t) => t.plain_text).join("") : "";

  return { id: page.id, title, keyword, searchedAt, resultCount, authorId };
}

export async function createSearchSession(input: {
  title: string;
  keyword: string;
  resultCount: number;
  authorId?: string;
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: sessionsDataSourceId() },
    properties: {
      [SESSION_PROPS.title]: {
        type: "title",
        title: [{ type: "text", text: { content: input.title } }],
      },
      [SESSION_PROPS.keyword]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.keyword } }],
      },
      [SESSION_PROPS.searchedAt]: {
        type: "date",
        date: { start: new Date().toISOString() },
      },
      [SESSION_PROPS.resultCount]: {
        type: "number",
        number: input.resultCount,
      },
      [SESSION_PROPS.authorId]: {
        type: "rich_text",
        rich_text: input.authorId ? [{ type: "text", text: { content: input.authorId } }] : [],
      },
    },
  });
  return page.id;
}

// /mypage의 "내 검색 기록" — 로그인 상태로 진행한 검색만 여기 걸림(§10.2
// 원칙상 비로그인 검색은 계정에 안 걸리는 게 정상).
export async function getSessionsByAuthor(authorId: string): Promise<SearchSession[]> {
  const sessions: SearchSession[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: sessionsDataSourceId(),
      filter: { property: SESSION_PROPS.authorId, rich_text: { equals: authorId } },
      sorts: [{ property: SESSION_PROPS.searchedAt, direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    sessions.push(...res.results.filter(isFullPage).map(parseSession));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return sessions;
}

export async function getSessionById(
  id: string
): Promise<SearchSession | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (!isFullPage(page)) return null;
    return parseSession(page);
  } catch {
    return null;
  }
}

// 2026-08 유입 전략(활성 신호) — 홈의 "방금 조회된 키워드" 티커용. 실제
// 검색 세션에서 키워드만 뽑아 중복 제거해 반환 — 가짜 활동을 만들지 않는다는
// 원칙(§18.7.1)대로 진짜 조회 기록만 씀. 세션ID·작성자 등 다른 정보는 절대
// 노출하지 않고 키워드 문자열만 반환. 홈이 force-dynamic이라 방문마다 Notion을
// 때리지 않도록 5분 TTL 캐시.
const RECENT_KEYWORDS_CACHE_TTL_MS = 5 * 60 * 1000;
const recentKeywordsCache = createTtlCache<string, string[]>(RECENT_KEYWORDS_CACHE_TTL_MS);

export async function getRecentSearchKeywords(limit = 12): Promise<string[]> {
  const cached = recentKeywordsCache.get("all");
  if (cached) return cached.slice(0, limit);

  const res = await notion.dataSources.query({
    data_source_id: sessionsDataSourceId(),
    sorts: [{ property: SESSION_PROPS.searchedAt, direction: "descending" }],
    page_size: 30,
  });

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const page of res.results.filter(isFullPage) as PageObjectResponse[]) {
    const session = parseSession(page);
    // 한 세션에 콤마로 여러 시드 키워드가 들어갈 수 있음(MAX_SEED_KEYWORDS).
    for (const raw of session.keyword.split(",")) {
      const keyword = raw.trim();
      if (!keyword || seen.has(keyword)) continue;
      seen.add(keyword);
      keywords.push(keyword);
    }
  }

  recentKeywordsCache.set("all", keywords);
  return keywords.slice(0, limit);
}

export async function countSessionsToday(): Promise<number> {
  const { startIso, endIso } = kstDayRangeUtcIso(0);
  // Notion's date filter doesn't AND on_or_after+before together when both
  // are given on the same condition object — it silently returns rows
  // outside the intended range (confirmed by direct query: got results
  // back to 4 days earlier). Each bound needs its own filter, joined by an
  // explicit "and" — same fix applied everywhere else in this file.
  return countRowsMatching(sessionsDataSourceId(), {
    and: [
      { property: SESSION_PROPS.searchedAt, date: { on_or_after: startIso } },
      { property: SESSION_PROPS.searchedAt, date: { before: endIso } },
    ],
  });
}

// 관리자 대시보드의 "최근 7일 검색 키워드" 카드 로그용 — days=7이면 오늘
// 포함 최근 7일(daysAgo=6부터 오늘까지).
export async function getSessionsInRange(days: number): Promise<SearchSession[]> {
  const { startIso } = kstDayRangeUtcIso(days - 1);
  const sessions: SearchSession[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: sessionsDataSourceId(),
      filter: { property: SESSION_PROPS.searchedAt, date: { on_or_after: startIso } },
      sorts: [{ property: SESSION_PROPS.searchedAt, direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    sessions.push(...res.results.filter(isFullPage).map(parseSession));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return sessions;
}
