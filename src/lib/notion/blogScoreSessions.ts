import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { BLOG_SCORE_SESSION_PROPS } from "./schema";
import type { BlogScoreGap, BlogScoreSession } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function sessionsDataSourceId(): string {
  return requireEnv("NOTION_BLOG_SCORE_SESSIONS_DB_ID");
}

function richText(prop: PageObjectResponse["properties"][string] | undefined): string {
  return prop?.type === "rich_text" ? prop.rich_text.map((t) => t.plain_text).join("") : "";
}

function parseCsv(raw: string): string[] {
  return raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function parseGaps(raw: string): BlogScoreGap[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSession(page: PageObjectResponse): BlogScoreSession {
  const props = page.properties;

  const titleProp = props[BLOG_SCORE_SESSION_PROPS.title];
  const title =
    titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  const dateProp = props[BLOG_SCORE_SESSION_PROPS.searchedAt];
  const searchedAt = dateProp?.type === "date" ? dateProp.date?.start ?? "" : "";

  return {
    id: page.id,
    title,
    myBlogDomain: richText(props[BLOG_SCORE_SESSION_PROPS.myBlogDomain]),
    competitorDomains: parseCsv(richText(props[BLOG_SCORE_SESSION_PROPS.competitorDomains])),
    keywords: parseCsv(richText(props[BLOG_SCORE_SESSION_PROPS.keywords])),
    searchedAt,
    gaps: parseGaps(richText(props[BLOG_SCORE_SESSION_PROPS.gapSummary])),
  };
}

export async function createBlogScoreSession(input: {
  title: string;
  myBlogDomain: string;
  competitorDomains: string[];
  keywords: string[];
  gaps: BlogScoreGap[];
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: sessionsDataSourceId() },
    properties: {
      [BLOG_SCORE_SESSION_PROPS.title]: {
        type: "title",
        title: [{ type: "text", text: { content: input.title } }],
      },
      [BLOG_SCORE_SESSION_PROPS.myBlogDomain]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.myBlogDomain } }],
      },
      [BLOG_SCORE_SESSION_PROPS.competitorDomains]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.competitorDomains.join(", ") } }],
      },
      [BLOG_SCORE_SESSION_PROPS.keywords]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.keywords.join(", ") } }],
      },
      [BLOG_SCORE_SESSION_PROPS.searchedAt]: {
        type: "date",
        date: { start: new Date().toISOString() },
      },
      [BLOG_SCORE_SESSION_PROPS.gapSummary]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: JSON.stringify(input.gaps).slice(0, 1900) } }],
      },
    },
  });
  return page.id;
}

export async function getBlogScoreSessionById(id: string): Promise<BlogScoreSession | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (!isFullPage(page)) return null;
    return parseSession(page);
  } catch {
    return null;
  }
}
