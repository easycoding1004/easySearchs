import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDatabase } from "@notionhq/client";
import { KEYWORD_WATCH_PROPS } from "../src/lib/notion/schema";

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
  console.log("Creating 관심 키워드 (Keyword Watches) database...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "관심 키워드" } }],
    initial_data_source: {
      properties: {
        [KEYWORD_WATCH_PROPS.title]: { type: "title", title: {} },
        [KEYWORD_WATCH_PROPS.authorId]: { type: "rich_text", rich_text: {} },
        [KEYWORD_WATCH_PROPS.baselineCount]: { type: "number", number: {} },
        [KEYWORD_WATCH_PROPS.lastNotifiedCount]: { type: "number", number: {} },
        [KEYWORD_WATCH_PROPS.lastNotifiedAt]: { type: "date", date: {} },
        [KEYWORD_WATCH_PROPS.createdAt]: { type: "date", date: {} },
      },
    },
  });

  if (!isFullDatabase(db)) {
    throw new Error(
      "Notion returned a partial response — the Integration may be missing read content capability."
    );
  }
  const dataSourceId = db.data_sources[0].id;

  console.log(`  DB id: ${db.id}`);
  console.log(`  Data source id: ${dataSourceId}`);
  console.log("\nDone. Paste this into .env.local:\n");
  console.log(`NOTION_KEYWORD_WATCHES_DB_ID=${dataSourceId}`);
}

main().catch((err) => {
  console.error("Notion keyword watches DB setup failed:", err);
  process.exit(1);
});
