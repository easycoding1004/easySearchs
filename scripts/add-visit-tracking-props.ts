import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { VISIT_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const visitsDataSourceId = process.env.NOTION_VISITS_DB_ID;

if (!notionToken || !visitsDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_VISITS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: adds the 유입경로/진입 페이지 select properties to the
// existing 방문 기록 데이터소스. dataSources.update() only touches the
// properties named in this call — 방문자ID/방문일 and all existing rows are
// left untouched.
async function main() {
  console.log("Adding 유입경로/진입 페이지 properties to 방문 기록...");
  await notion.dataSources.update({
    data_source_id: visitsDataSourceId!,
    properties: {
      [VISIT_PROPS.referrer]: { type: "select", select: {} },
      [VISIT_PROPS.landingPage]: { type: "select", select: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add visit tracking properties:", err);
  process.exit(1);
});
