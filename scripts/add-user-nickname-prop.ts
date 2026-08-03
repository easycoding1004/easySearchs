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

// One-off migration: adds 닉네임 to the existing 사용자 계정 database for the
// board feature's public author display (CLAUDE.md §16, 2026-08) — separate
// from the login email/이메일. Additive only — existing rows/properties untouched.
async function main() {
  console.log("Adding 닉네임 property to 사용자 계정...");
  await notion.dataSources.update({
    data_source_id: usersDataSourceId!,
    properties: {
      [USER_PROPS.nickname]: { type: "rich_text", rich_text: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add 닉네임 property:", err);
  process.exit(1);
});
