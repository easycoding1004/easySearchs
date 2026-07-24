import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDatabase, isFullDataSource } from "@notionhq/client";
import {
  RECORD_PROPS,
  SESSION_PROPS,
  BLOG_SCORE_SESSION_PROPS,
  BLOG_SCORE_RECORD_PROPS,
  INQUIRY_PROPS,
} from "../src/lib/notion/schema";

function requireDataSourceId(
  db: Parameters<typeof isFullDatabase>[0],
  label: string
): string {
  if (!isFullDatabase(db)) {
    throw new Error(
      `Notion returned a partial response for ${label} — the Integration may be missing read content capability.`
    );
  }
  return db.data_sources[0].id;
}

// Notion API 2025-09-03+ splits each database into one or more "data
// sources" — properties, relations, and page parents all key off the
// data_source_id, not the database_id. A freshly created database has
// exactly one data source, so we treat that data source's id as "the DB id"
// everywhere else in this app.

const notionToken = process.env.NOTION_TOKEN;
const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

if (!notionToken || !parentPageId) {
  console.error(
    "Missing NOTION_TOKEN or NOTION_PARENT_PAGE_ID in .env.local. " +
      "Make sure the parent page is shared with your Integration first."
  );
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

async function main() {
  console.log("Creating 검색 세션 (Search Sessions) database...");
  const sessionsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "검색 세션" } }],
    initial_data_source: {
      properties: {
        [SESSION_PROPS.title]: { type: "title", title: {} },
        [SESSION_PROPS.keyword]: { type: "rich_text", rich_text: {} },
        [SESSION_PROPS.searchedAt]: { type: "date", date: {} },
        [SESSION_PROPS.resultCount]: {
          type: "number",
          number: { format: "number" },
        },
      },
    },
  });
  const sessionsDataSourceId = requireDataSourceId(sessionsDb, "검색 세션");
  console.log(`  DB id: ${sessionsDb.id}`);
  console.log(`  Data source id: ${sessionsDataSourceId}`);

  console.log("Creating 키워드 검색 결과 (Keyword Search Records) database...");
  const recordsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "키워드 검색 결과" } }],
    initial_data_source: {
      properties: {
        [RECORD_PROPS.title]: { type: "title", title: {} },
        [RECORD_PROPS.kind]: {
          type: "select",
          select: {
            options: [{ name: "시드 키워드" }, { name: "연관 키워드" }],
          },
        },
        [RECORD_PROPS.session]: {
          type: "relation",
          relation: {
            data_source_id: sessionsDataSourceId,
            type: "dual_property",
            dual_property: {},
          },
        },
        [RECORD_PROPS.pcCount]: {
          type: "number",
          number: { format: "number" },
        },
        [RECORD_PROPS.mobileCount]: {
          type: "number",
          number: { format: "number" },
        },
        [RECORD_PROPS.totalCount]: {
          type: "formula",
          formula: {
            expression: `prop("${RECORD_PROPS.pcCount}") + prop("${RECORD_PROPS.mobileCount}")`,
          },
        },
        [RECORD_PROPS.compIdx]: {
          type: "select",
          select: {
            options: [
              { name: "낮음" },
              { name: "중간" },
              { name: "높음" },
            ],
          },
        },
        [RECORD_PROPS.avgAdDepth]: {
          type: "number",
          number: { format: "number" },
        },
        [RECORD_PROPS.totalBlogPosts]: {
          type: "number",
          number: { format: "number" },
        },
        [RECORD_PROPS.monthlyBlogPosts]: {
          type: "number",
          number: { format: "number" },
        },
        [RECORD_PROPS.blogSaturation]: {
          type: "number",
          number: { format: "number" },
        },
        [RECORD_PROPS.checkedAt]: { type: "created_time", created_time: {} },
      },
    },
  });
  const recordsDataSourceId = requireDataSourceId(recordsDb, "키워드 검색 결과");
  console.log(`  DB id: ${recordsDb.id}`);
  console.log(`  Data source id: ${recordsDataSourceId}`);

  await renameAutoRelation(sessionsDataSourceId, "검색 세션", SESSION_PROPS.relatedRecords);

  console.log("\nCreating 블로그지수 세션 (Blog Score Sessions) database...");
  const blogSessionsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "블로그지수 세션" } }],
    initial_data_source: {
      properties: {
        [BLOG_SCORE_SESSION_PROPS.title]: { type: "title", title: {} },
        [BLOG_SCORE_SESSION_PROPS.myBlogDomain]: { type: "rich_text", rich_text: {} },
        [BLOG_SCORE_SESSION_PROPS.competitorDomains]: { type: "rich_text", rich_text: {} },
        [BLOG_SCORE_SESSION_PROPS.keywords]: { type: "rich_text", rich_text: {} },
        [BLOG_SCORE_SESSION_PROPS.searchedAt]: { type: "date", date: {} },
        [BLOG_SCORE_SESSION_PROPS.gapSummary]: { type: "rich_text", rich_text: {} },
      },
    },
  });
  const blogSessionsDataSourceId = requireDataSourceId(blogSessionsDb, "블로그지수 세션");
  console.log(`  DB id: ${blogSessionsDb.id}`);
  console.log(`  Data source id: ${blogSessionsDataSourceId}`);

  console.log("Creating 블로그지수 결과 (Blog Score Records) database...");
  const blogRecordsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "블로그지수 결과" } }],
    initial_data_source: {
      properties: {
        [BLOG_SCORE_RECORD_PROPS.title]: { type: "title", title: {} },
        [BLOG_SCORE_RECORD_PROPS.label]: { type: "rich_text", rich_text: {} },
        [BLOG_SCORE_RECORD_PROPS.isMine]: { type: "checkbox", checkbox: {} },
        [BLOG_SCORE_RECORD_PROPS.session]: {
          type: "relation",
          relation: {
            data_source_id: blogSessionsDataSourceId,
            type: "dual_property",
            dual_property: {},
          },
        },
        [BLOG_SCORE_RECORD_PROPS.compositeScore]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.postVolume]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.keywordCoverage]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.highVolumeCoverage]: {
          type: "number",
          number: { format: "number" },
        },
        [BLOG_SCORE_RECORD_PROPS.lowCompetitionCoverage]: {
          type: "number",
          number: { format: "number" },
        },
        [BLOG_SCORE_RECORD_PROPS.exposureRank]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.freshness]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.engagement]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.category]: { type: "rich_text", rich_text: {} },
        [BLOG_SCORE_RECORD_PROPS.todayVisitor]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.totalVisitor]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.subscriberCount]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.postCount]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.avgRecentComments]: { type: "number", number: { format: "number" } },
        [BLOG_SCORE_RECORD_PROPS.topTerms]: { type: "rich_text", rich_text: {} },
        [BLOG_SCORE_RECORD_PROPS.checkedAt]: { type: "created_time", created_time: {} },
      },
    },
  });
  const blogRecordsDataSourceId = requireDataSourceId(blogRecordsDb, "블로그지수 결과");
  console.log(`  DB id: ${blogRecordsDb.id}`);
  console.log(`  Data source id: ${blogRecordsDataSourceId}`);

  await renameAutoRelation(
    blogSessionsDataSourceId,
    "블로그지수 세션",
    BLOG_SCORE_SESSION_PROPS.relatedRecords
  );

  console.log("\nCreating 문의 (Inquiries) database...");
  const inquiriesDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "문의" } }],
    initial_data_source: {
      properties: {
        [INQUIRY_PROPS.title]: { type: "title", title: {} },
        [INQUIRY_PROPS.name]: { type: "rich_text", rich_text: {} },
        [INQUIRY_PROPS.email]: { type: "rich_text", rich_text: {} },
        [INQUIRY_PROPS.message]: { type: "rich_text", rich_text: {} },
        [INQUIRY_PROPS.handled]: { type: "checkbox", checkbox: {} },
        [INQUIRY_PROPS.receivedAt]: { type: "created_time", created_time: {} },
      },
    },
  });
  const inquiriesDataSourceId = requireDataSourceId(inquiriesDb, "문의");
  console.log(`  DB id: ${inquiriesDb.id}`);
  console.log(`  Data source id: ${inquiriesDataSourceId}`);

  console.log("\nDone. Paste these into .env.local:\n");
  console.log(`NOTION_SESSIONS_DB_ID=${sessionsDataSourceId}`);
  console.log(`NOTION_KEYWORDS_DB_ID=${recordsDataSourceId}`);
  console.log(`NOTION_BLOG_SCORE_SESSIONS_DB_ID=${blogSessionsDataSourceId}`);
  console.log(`NOTION_BLOG_SCORE_RECORDS_DB_ID=${blogRecordsDataSourceId}`);
  console.log(`NOTION_INQUIRIES_DB_ID=${inquiriesDataSourceId}`);
}

async function renameAutoRelation(dataSourceId: string, label: string, newName: string) {
  console.log(`Renaming the auto-generated relation property on ${label} to ${newName}...`);
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  if (!isFullDataSource(dataSource)) {
    throw new Error(`Notion returned a partial response for ${label}'s data source.`);
  }
  const autoRelationEntry = Object.entries(dataSource.properties).find(
    ([, prop]) => prop.type === "relation"
  );
  if (!autoRelationEntry) {
    throw new Error(
      `Could not find the auto-generated relation property on ${label} — ` +
        `check the Notion UI and rename it to ${newName} manually.`
    );
  }
  const [autoRelationName] = autoRelationEntry;
  await notion.dataSources.update({
    data_source_id: dataSourceId,
    properties: {
      [autoRelationName]: { name: newName },
    },
  });
}

main().catch((err) => {
  console.error("Notion setup failed:", err);
  process.exit(1);
});
