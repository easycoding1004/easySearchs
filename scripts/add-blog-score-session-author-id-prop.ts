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

// Additive-only 마이그레이션(§CLAUDE.md 원칙) — 개인 도구의
// add-session-author-id-prop.ts와 완전히 동일한 목적·패턴.
async function main() {
  console.log("Adding 작성자ID property to 블로그지수 세션 DB...");
  await notion.dataSources.update({
    data_source_id: sessionsDataSourceId!,
    properties: {
      [BLOG_SCORE_SESSION_PROPS.authorId]: { type: "rich_text", rich_text: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
