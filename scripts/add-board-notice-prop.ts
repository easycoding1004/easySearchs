import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { BOARD_POST_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const postsDataSourceId = process.env.NOTION_BOARD_POSTS_DB_ID;
if (!notionToken || !postsDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_BOARD_POSTS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration (2026-08, "공지사항도 테이블 상단에 공지라고 등록"):
// adds 공지여부(checkbox) to the existing 게시판 게시글 database. Additive
// only — 기존 속성/데이터는 그대로 둠, 기존 글은 전부 false로 시작.
async function main() {
  console.log("Adding 공지여부 property to 게시판 게시글...");
  await notion.dataSources.update({
    data_source_id: postsDataSourceId!,
    properties: {
      [BOARD_POST_PROPS.isNotice]: { type: "checkbox", checkbox: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add 공지여부 property:", err);
  process.exit(1);
});
