import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { BOARD_POST_PROPS, BOARD_COMMENT_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const postsDataSourceId = process.env.NOTION_BOARD_POSTS_DB_ID;
const commentsDataSourceId = process.env.NOTION_BOARD_COMMENTS_DB_ID;

if (!notionToken || !postsDataSourceId || !commentsDataSourceId) {
  console.error(
    "Missing NOTION_TOKEN or NOTION_BOARD_POSTS_DB_ID or NOTION_BOARD_COMMENTS_DB_ID in .env.local."
  );
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: 게시판 게시글/댓글 DB에 "표시일시"(date) 속성을 추가함.
// Notion의 작성일시(created_time)는 API로 과거 시점을 지정할 수 없는 읽기
// 전용 속성이라, 시드 데이터처럼 과거 시점의 글을 넣어야 할 때 쓸 별도
// 필드가 필요해서 추가함 — additive only, 기존 데이터/속성은 안 건드림.
async function main() {
  console.log("Adding 표시일시 property to 게시판 게시글...");
  await notion.dataSources.update({
    data_source_id: postsDataSourceId!,
    properties: {
      [BOARD_POST_PROPS.postedAt]: { type: "date", date: {} },
    },
  });

  console.log("Adding 표시일시 property to 게시판 댓글...");
  await notion.dataSources.update({
    data_source_id: commentsDataSourceId!,
    properties: {
      [BOARD_COMMENT_PROPS.postedAt]: { type: "date", date: {} },
    },
  });

  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add 표시일시 property:", err);
  process.exit(1);
});
