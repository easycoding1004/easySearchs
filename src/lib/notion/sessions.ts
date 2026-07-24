import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { SESSION_PROPS } from "./schema";
import type { SearchSession } from "./types";

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

export async function getRecentSessions(
  limit = 10
): Promise<SearchSession[]> {
  const response = await notion.dataSources.query({
    data_source_id: sessionsDataSourceId(),
    sorts: [{ property: SESSION_PROPS.searchedAt, direction: "descending" }],
    page_size: limit,
  });
  return response.results.filter(isFullPage).map(parseSession);
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
