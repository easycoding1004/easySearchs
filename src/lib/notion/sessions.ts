import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { SESSION_PROPS } from "./schema";
import type { SearchSession } from "./types";
import { countRowsMatching } from "./queryHelpers";
import { kstDayRangeUtcIso } from "../utils/formatDate";

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

  return { id: page.id, title, keyword, searchedAt, resultCount };
}

export async function createSearchSession(input: {
  title: string;
  keyword: string;
  resultCount: number;
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
    },
  });
  return page.id;
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
