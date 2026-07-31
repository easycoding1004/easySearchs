import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { BLOG_SCORE_RECORD_PROPS } from "./schema";
import type { BlogScoreRecord } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function recordsDataSourceId(): string {
  return requireEnv("NOTION_BLOG_SCORE_RECORDS_DB_ID");
}

function parseRecord(page: PageObjectResponse): BlogScoreRecord {
  const props = page.properties;

  const titleProp = props[BLOG_SCORE_RECORD_PROPS.title];
  const domain = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  const labelProp = props[BLOG_SCORE_RECORD_PROPS.label];
  const label =
    labelProp?.type === "rich_text" ? labelProp.rich_text.map((t) => t.plain_text).join("") : domain;

  const isMineProp = props[BLOG_SCORE_RECORD_PROPS.isMine];
  const isMine = isMineProp?.type === "checkbox" ? isMineProp.checkbox : false;

  function num(key: string): number {
    const p = props[key];
    return p?.type === "number" ? (p.number ?? 0) : 0;
  }
  function numOrNull(key: string): number | null {
    const p = props[key];
    return p?.type === "number" ? p.number : null;
  }

  const categoryProp = props[BLOG_SCORE_RECORD_PROPS.category];
  const categoryText =
    categoryProp?.type === "rich_text" ? categoryProp.rich_text.map((t) => t.plain_text).join("") : "";

  const topTermsProp = props[BLOG_SCORE_RECORD_PROPS.topTerms];
  const topTermsText =
    topTermsProp?.type === "rich_text" ? topTermsProp.rich_text.map((t) => t.plain_text).join("") : "";
  let topTerms: { term: string; count: number }[] = [];
  if (topTermsText) {
    try {
      const parsed = JSON.parse(topTermsText);
      if (Array.isArray(parsed)) topTerms = parsed;
    } catch {
      // Ignore malformed stored JSON rather than failing the whole record.
    }
  }

  const checkedAtProp = props[BLOG_SCORE_RECORD_PROPS.checkedAt];
  const checkedAt = checkedAtProp?.type === "created_time" ? checkedAtProp.created_time : "";

  return {
    id: page.id,
    domain,
    label,
    isMine,
    compositeScore: num(BLOG_SCORE_RECORD_PROPS.compositeScore),
    postVolume: num(BLOG_SCORE_RECORD_PROPS.postVolume),
    exposureRank: num(BLOG_SCORE_RECORD_PROPS.exposureRank),
    engagement: num(BLOG_SCORE_RECORD_PROPS.engagement),
    reactionScore: num(BLOG_SCORE_RECORD_PROPS.reactionScore),
    shareScore: num(BLOG_SCORE_RECORD_PROPS.shareScore),
    category: categoryText || null,
    todayVisitor: numOrNull(BLOG_SCORE_RECORD_PROPS.todayVisitor),
    totalVisitor: numOrNull(BLOG_SCORE_RECORD_PROPS.totalVisitor),
    subscriberCount: numOrNull(BLOG_SCORE_RECORD_PROPS.subscriberCount),
    postCount: numOrNull(BLOG_SCORE_RECORD_PROPS.postCount),
    avgRecentComments: numOrNull(BLOG_SCORE_RECORD_PROPS.avgRecentComments),
    avgRecentReactions: numOrNull(BLOG_SCORE_RECORD_PROPS.avgRecentReactions),
    avgRecentShares: numOrNull(BLOG_SCORE_RECORD_PROPS.avgRecentShares),
    topTerms,
    checkedAt,
  };
}

export async function createBlogScoreRecord(input: {
  sessionId: string;
  domain: string;
  label: string;
  isMine: boolean;
  compositeScore: number;
  postVolume: number;
  exposureRank: number;
  engagement: number;
  reactionScore: number;
  shareScore: number;
  category: string | null;
  todayVisitor: number | null;
  totalVisitor: number | null;
  subscriberCount: number | null;
  postCount: number | null;
  avgRecentComments: number | null;
  avgRecentReactions: number | null;
  avgRecentShares: number | null;
  topTerms: { term: string; count: number }[];
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: recordsDataSourceId() },
    properties: {
      [BLOG_SCORE_RECORD_PROPS.title]: {
        type: "title",
        title: [{ type: "text", text: { content: input.domain } }],
      },
      [BLOG_SCORE_RECORD_PROPS.label]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.label } }],
      },
      [BLOG_SCORE_RECORD_PROPS.isMine]: { type: "checkbox", checkbox: input.isMine },
      [BLOG_SCORE_RECORD_PROPS.session]: {
        type: "relation",
        relation: [{ id: input.sessionId }],
      },
      [BLOG_SCORE_RECORD_PROPS.compositeScore]: { type: "number", number: input.compositeScore },
      [BLOG_SCORE_RECORD_PROPS.postVolume]: { type: "number", number: input.postVolume },
      [BLOG_SCORE_RECORD_PROPS.exposureRank]: { type: "number", number: input.exposureRank },
      [BLOG_SCORE_RECORD_PROPS.engagement]: { type: "number", number: input.engagement },
      [BLOG_SCORE_RECORD_PROPS.reactionScore]: { type: "number", number: input.reactionScore },
      [BLOG_SCORE_RECORD_PROPS.shareScore]: { type: "number", number: input.shareScore },
      ...(input.topTerms.length > 0
        ? {
            [BLOG_SCORE_RECORD_PROPS.topTerms]: {
              type: "rich_text" as const,
              rich_text: [
                { type: "text" as const, text: { content: JSON.stringify(input.topTerms).slice(0, 1900) } },
              ],
            },
          }
        : {}),
      ...(input.category
        ? {
            [BLOG_SCORE_RECORD_PROPS.category]: {
              type: "rich_text" as const,
              rich_text: [{ type: "text" as const, text: { content: input.category } }],
            },
          }
        : {}),
      ...(input.todayVisitor != null
        ? {
            [BLOG_SCORE_RECORD_PROPS.todayVisitor]: {
              type: "number" as const,
              number: input.todayVisitor,
            },
          }
        : {}),
      ...(input.totalVisitor != null
        ? {
            [BLOG_SCORE_RECORD_PROPS.totalVisitor]: {
              type: "number" as const,
              number: input.totalVisitor,
            },
          }
        : {}),
      ...(input.subscriberCount != null
        ? {
            [BLOG_SCORE_RECORD_PROPS.subscriberCount]: {
              type: "number" as const,
              number: input.subscriberCount,
            },
          }
        : {}),
      ...(input.postCount != null
        ? {
            [BLOG_SCORE_RECORD_PROPS.postCount]: {
              type: "number" as const,
              number: input.postCount,
            },
          }
        : {}),
      ...(input.avgRecentComments != null
        ? {
            [BLOG_SCORE_RECORD_PROPS.avgRecentComments]: {
              type: "number" as const,
              number: input.avgRecentComments,
            },
          }
        : {}),
      ...(input.avgRecentReactions != null
        ? {
            [BLOG_SCORE_RECORD_PROPS.avgRecentReactions]: {
              type: "number" as const,
              number: input.avgRecentReactions,
            },
          }
        : {}),
      ...(input.avgRecentShares != null
        ? {
            [BLOG_SCORE_RECORD_PROPS.avgRecentShares]: {
              type: "number" as const,
              number: input.avgRecentShares,
            },
          }
        : {}),
    },
  });
  return page.id;
}

export async function getRecordsForBlogScoreSession(
  sessionId: string
): Promise<BlogScoreRecord[]> {
  const response = await notion.dataSources.query({
    data_source_id: recordsDataSourceId(),
    filter: {
      property: BLOG_SCORE_RECORD_PROPS.session,
      relation: { contains: sessionId },
    },
    sorts: [{ property: BLOG_SCORE_RECORD_PROPS.compositeScore, direction: "descending" }],
  });
  return response.results.filter(isFullPage).map(parseRecord);
}
