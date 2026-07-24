import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import type { CompetitionLevel, NormalizedKeywordRow } from "@/lib/naver/types";
import type { BlogPublishStats } from "@/lib/naver/blogPublishStats";
import { notion } from "./client";
import { KEYWORD_KIND, RECORD_PROPS } from "./schema";
import type { KeywordKind, KeywordRecord } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function recordsDataSourceId(): string {
  return requireEnv("NOTION_KEYWORDS_DB_ID");
}

function parseRecord(page: PageObjectResponse): KeywordRecord {
  const props = page.properties;

  const titleProp = props[RECORD_PROPS.title];
  const keyword =
    titleProp?.type === "title"
      ? titleProp.title.map((t) => t.plain_text).join("")
      : "";

  const kindProp = props[RECORD_PROPS.kind];
  const kindName = kindProp?.type === "select" ? kindProp.select?.name : undefined;
  const kind: KeywordKind =
    kindName === KEYWORD_KIND.seed || kindName === KEYWORD_KIND.inferred
      ? kindName
      : KEYWORD_KIND.related;

  const pcProp = props[RECORD_PROPS.pcCount];
  const pcCount = pcProp?.type === "number" ? pcProp.number ?? 0 : 0;

  const mobileProp = props[RECORD_PROPS.mobileCount];
  const mobileCount = mobileProp?.type === "number" ? mobileProp.number ?? 0 : 0;

  const totalProp = props[RECORD_PROPS.totalCount];
  const totalCount =
    totalProp?.type === "formula" && totalProp.formula.type === "number"
      ? totalProp.formula.number ?? 0
      : pcCount + mobileCount;

  const compProp = props[RECORD_PROPS.compIdx];
  const compIdx: CompetitionLevel | null =
    compProp?.type === "select"
      ? (compProp.select?.name as CompetitionLevel | undefined) ?? null
      : null;

  const adDepthProp = props[RECORD_PROPS.avgAdDepth];
  const avgAdDepth =
    adDepthProp?.type === "number" ? adDepthProp.number ?? 0 : 0;

  const totalBlogPostsProp = props[RECORD_PROPS.totalBlogPosts];
  const totalBlogPosts =
    totalBlogPostsProp?.type === "number" ? totalBlogPostsProp.number : null;

  const monthlyBlogPostsProp = props[RECORD_PROPS.monthlyBlogPosts];
  const monthlyBlogPosts =
    monthlyBlogPostsProp?.type === "number" ? monthlyBlogPostsProp.number : null;

  const blogSaturationProp = props[RECORD_PROPS.blogSaturation];
  const blogSaturation =
    blogSaturationProp?.type === "number" ? blogSaturationProp.number : null;

  const checkedAtProp = props[RECORD_PROPS.checkedAt];
  const checkedAt =
    checkedAtProp?.type === "created_time" ? checkedAtProp.created_time : "";

  return {
    id: page.id,
    keyword,
    kind,
    pcCount,
    mobileCount,
    totalCount,
    compIdx,
    avgAdDepth,
    totalBlogPosts,
    monthlyBlogPosts,
    blogSaturation,
    checkedAt,
  };
}

export async function createKeywordRecord(input: {
  sessionId: string;
  row: NormalizedKeywordRow;
  kind: KeywordKind;
  blogPublishStats?: BlogPublishStats | null;
}): Promise<string> {
  const { row, blogPublishStats } = input;
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: recordsDataSourceId() },
    properties: {
      [RECORD_PROPS.title]: {
        type: "title",
        title: [{ type: "text", text: { content: row.relKeyword } }],
      },
      [RECORD_PROPS.kind]: {
        type: "select",
        select: { name: input.kind },
      },
      [RECORD_PROPS.session]: {
        type: "relation",
        relation: [{ id: input.sessionId }],
      },
      [RECORD_PROPS.pcCount]: {
        type: "number",
        number: row.monthlyPcQcCnt,
      },
      [RECORD_PROPS.mobileCount]: {
        type: "number",
        number: row.monthlyMobileQcCnt,
      },
      ...(row.compIdx
        ? {
            [RECORD_PROPS.compIdx]: {
              type: "select" as const,
              select: { name: row.compIdx },
            },
          }
        : {}),
      [RECORD_PROPS.avgAdDepth]: {
        type: "number",
        number: row.plAvgDepth,
      },
      ...(blogPublishStats
        ? {
            [RECORD_PROPS.totalBlogPosts]: {
              type: "number" as const,
              number: blogPublishStats.totalPosts,
            },
            [RECORD_PROPS.monthlyBlogPosts]: {
              type: "number" as const,
              number: blogPublishStats.monthlyPosts,
            },
            [RECORD_PROPS.blogSaturation]: {
              type: "number" as const,
              number: blogPublishStats.saturation,
            },
          }
        : {}),
    },
  });
  return page.id;
}

export async function getRecordsForSession(
  sessionId: string
): Promise<KeywordRecord[]> {
  const response = await notion.dataSources.query({
    data_source_id: recordsDataSourceId(),
    filter: {
      property: RECORD_PROPS.session,
      relation: { contains: sessionId },
    },
    sorts: [{ property: RECORD_PROPS.totalCount, direction: "descending" }],
  });
  return response.results.filter(isFullPage).map(parseRecord);
}
