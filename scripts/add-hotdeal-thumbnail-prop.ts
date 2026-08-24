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

// One-off migration: adds 썸네일URL to the existing 핫딜정보 게시글 database
// (2026-08, 목록에 제품 사진 표시). Additive only — 기존 속성/데이터는 그대로 둠.
async function main() {
  console.log("Adding 썸네일URL property to 핫딜정보 게시글...");
  await notion.dataSources.update({
    data_source_id: postsDataSourceId!,
    properties: {
      [HOTDEAL_POST_PROPS.thumbnailUrl]: { type: "url", url: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add 썸네일URL property:", err);
  process.exit(1);
});
