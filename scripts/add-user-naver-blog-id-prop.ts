import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { USER_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const usersDataSourceId = process.env.NOTION_USERS_DB_ID;

if (!notionToken || !usersDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_USERS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: adds 네이버블로그ID to the existing 사용자 계정 database
// for the "네이버 블로그 글쓰기 열기" button (CLAUDE.md §16, 2026-07). Additive
// only — existing rows and properties untouched.
async function main() {
  console.log("Adding 네이버블로그ID property to 사용자 계정...");
  await notion.dataSources.update({
    data_source_id: usersDataSourceId!,
    properties: {
      [USER_PROPS.naverBlogId]: { type: "rich_text", rich_text: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add 네이버블로그ID property:", err);
  process.exit(1);
});
