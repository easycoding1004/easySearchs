import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { HOTDEAL_POST_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const postsDataSourceId = process.env.NOTION_HOTDEAL_POSTS_DB_ID;

if (!notionToken || !postsDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_HOTDEAL_POSTS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: adds 원본ID to the existing 핫딜정보 게시글 database
// (2026-08, 루리웹 RSS 자동 수집) — 원본 게시글 URL을 dedup 키로 저장.
// Additive only — 기존 속성/데이터는 그대로 둠.
async function main() {
  console.log("Adding 원본ID property to 핫딜정보 게시글...");
  await notion.dataSources.update({
    data_source_id: postsDataSourceId!,
    properties: {
      [HOTDEAL_POST_PROPS.sourceId]: { type: "rich_text", rich_text: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add 원본ID property:", err);
  process.exit(1);
});
