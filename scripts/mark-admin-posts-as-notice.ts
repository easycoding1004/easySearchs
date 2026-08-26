import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullPage } from "@notionhq/client";
import { BOARD_POST_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const postsDataSourceId = process.env.NOTION_BOARD_POSTS_DB_ID;
if (!notionToken || !postsDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_BOARD_POSTS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off (2026-08) — 방금 seed-admin-board-posts.ts로 만든 관리자 안내글
// 3건을 공지로 지정. 제목으로 찾아서 표시(다시 실행해도 이미 공지인 글은
// 그대로 true로 다시 세팅될 뿐이라 멱등).
const TITLES = [
  "핫딜정보 게시판, 직접 등록도 가능해요",
  "소상공인 정책정보는 어디서 오는 정보인가요?",
  '"내 정보" 페이지 안내',
];

async function main() {
  for (const title of TITLES) {
    const res = await notion.dataSources.query({
      data_source_id: postsDataSourceId!,
      filter: { property: BOARD_POST_PROPS.title, title: { equals: title } },
      page_size: 1,
    });
    const page = res.results.find(isFullPage);
    if (!page) {
      console.error("not found:", title);
      continue;
    }
    await notion.pages.update({
      page_id: page.id,
      properties: { [BOARD_POST_PROPS.isNotice]: { type: "checkbox", checkbox: true } },
    });
    console.log("marked as notice:", title);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
