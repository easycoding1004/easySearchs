import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { BLOG_SCORE_SESSION_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const sessionsDataSourceId = process.env.NOTION_BLOG_SCORE_SESSIONS_DB_ID;

if (!notionToken || !sessionsDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_BLOG_SCORE_SESSIONS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: adds 업체명 to the existing 블로그지수 세션 database for
// the 2026-07 지역·플레이스 노출순위 기능(CLAUDE.md 섹션 10.3.2 참고).
// Additive only — existing rows/properties untouched.
async function main() {
  console.log("Adding 업체명 property to 블로그지수 세션...");
  await notion.dataSources.update({
    data_source_id: sessionsDataSourceId!,
    properties: {
      [BLOG_SCORE_SESSION_PROPS.businessName]: { type: "rich_text", rich_text: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add businessName property:", err);
  process.exit(1);
});
