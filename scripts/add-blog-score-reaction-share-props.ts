import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { BLOG_SCORE_RECORD_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const recordsDataSourceId = process.env.NOTION_BLOG_SCORE_RECORDS_DB_ID;

if (!notionToken || !recordsDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_BLOG_SCORE_RECORDS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: adds 최근 공감수/최근 공유수/공감수 점수/공유수 점수 to
// the existing 블로그지수 결과 database for the 2026-07 score-model overhaul
// (검색상위노출·게시글수·댓글수·공감수·공유수 5축, CLAUDE.md §10.3 참고).
// Additive only — existing rows and properties (including the now-legacy
// keywordCoverage/highVolumeCoverage/lowCompetitionCoverage/freshness
// columns) are left untouched.
async function main() {
  console.log("Adding 최근 공감수/최근 공유수/공감수 점수/공유수 점수 properties to 블로그지수 결과...");
  await notion.dataSources.update({
    data_source_id: recordsDataSourceId!,
    properties: {
      [BLOG_SCORE_RECORD_PROPS.avgRecentReactions]: { type: "number", number: { format: "number" } },
      [BLOG_SCORE_RECORD_PROPS.avgRecentShares]: { type: "number", number: { format: "number" } },
      [BLOG_SCORE_RECORD_PROPS.reactionScore]: { type: "number", number: { format: "number" } },
      [BLOG_SCORE_RECORD_PROPS.shareScore]: { type: "number", number: { format: "number" } },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add reaction/share properties:", err);
  process.exit(1);
});
