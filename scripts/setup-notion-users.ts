import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDatabase } from "@notionhq/client";
import { USER_PROPS } from "../src/lib/notion/schema";

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
  console.log("Creating 사용자 계정 (Users) database...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "사용자 계정" } }],
    initial_data_source: {
      properties: {
        [USER_PROPS.title]: { type: "title", title: {} },
        [USER_PROPS.passwordHash]: { type: "rich_text", rich_text: {} },
        [USER_PROPS.emailVerified]: { type: "checkbox", checkbox: {} },
        [USER_PROPS.verificationToken]: { type: "rich_text", rich_text: {} },
        [USER_PROPS.sessionToken]: { type: "rich_text", rich_text: {} },
        [USER_PROPS.sessionIssuedAt]: { type: "date", date: {} },
        [USER_PROPS.lastUsedAt]: { type: "date", date: {} },
        [USER_PROPS.createdAt]: { type: "date", date: {} },
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
  console.log(`NOTION_USERS_DB_ID=${dataSourceId}`);
}

main().catch((err) => {
  console.error("Notion users DB setup failed:", err);
  process.exit(1);
});
