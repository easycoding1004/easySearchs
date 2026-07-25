import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDatabase } from "@notionhq/client";
import { SNAPSHOT_PROPS, SNAPSHOT_SOURCE } from "../src/lib/notion/schema";

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
  console.log("Creating 키워드 검색량 스냅샷 (Keyword Volume Snapshots) database...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "키워드 검색량 스냅샷" } }],
    initial_data_source: {
      properties: {
        [SNAPSHOT_PROPS.title]: { type: "title", title: {} },
        [SNAPSHOT_PROPS.pcCount]: { type: "number", number: { format: "number" } },
        [SNAPSHOT_PROPS.mobileCount]: { type: "number", number: { format: "number" } },
        [SNAPSHOT_PROPS.collectedAt]: { type: "date", date: {} },
        [SNAPSHOT_PROPS.source]: {
          type: "select",
          select: {
            options: [
              { name: SNAPSHOT_SOURCE.userSearch },
              { name: SNAPSHOT_SOURCE.scheduledJob },
            ],
          },
        },
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
  console.log(`NOTION_KEYWORD_SNAPSHOTS_DB_ID=${dataSourceId}`);
}

main().catch((err) => {
  console.error("Notion snapshot DB setup failed:", err);
  process.exit(1);
});
