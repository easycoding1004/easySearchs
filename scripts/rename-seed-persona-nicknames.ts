import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullPage } from "@notionhq/client";
import { USER_PROPS, BOARD_POST_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const usersDataSourceId = process.env.NOTION_USERS_DB_ID;
const postsDataSourceId = process.env.NOTION_BOARD_POSTS_DB_ID;

if (!notionToken || !usersDataSourceId || !postsDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_USERS_DB_ID or NOTION_BOARD_POSTS_DB_ID in .env.local.");
  process.exit(1);
}

// scripts/seed-board-demo-content.ts와 같은 이유로 직접 만든 Client만 씀
// (client.ts의 즉시-생성 싱글턴을 간접 import하면 ESM 호이스팅 때문에
// 토큰이 비어있는 채로 생성됨 — seed-board-demo-content.ts 상단 주석 참고).
const notion = new Client({ auth: notionToken });

// 1회성: seed-board-demo-content.ts가 만든 가상 회원 10명의 닉네임을
// "필라테스원장" 같은 한국어 직업+직함 스타일에서 영문 핸들로 바꾸고,
// 이미 만들어둔 게시글 23건의 "작성자닉네임"(작성 시점 스냅샷)도 같이
// 소급 반영함(§CLAUDE.md 16 게시판 항목 — 작성자는 relation이 아니라
// 스냅샷이라 계정 닉네임만 바꿔서는 기존 글에 자동 반영 안 됨).
const RENAMES: { email: string; newNickname: string }[] = [
  { email: "seed-cafe01@ezzsearch.local", newNickname: "mia_cafe" },
  { email: "seed-bakery02@ezzsearch.local", newNickname: "tom_bakes" },
  { email: "seed-pilates03@ezzsearch.local", newNickname: "jenny_flow" },
  { email: "seed-cleaning04@ezzsearch.local", newNickname: "alex_clean" },
  { email: "seed-tutor05@ezzsearch.local", newNickname: "kate_tutors" },
  { email: "seed-nail06@ezzsearch.local", newNickname: "sophie_nails" },
  { email: "seed-pension07@ezzsearch.local", newNickname: "mark_stay" },
  { email: "seed-shop08@ezzsearch.local", newNickname: "liam_shop" },
  { email: "seed-studio09@ezzsearch.local", newNickname: "noah_shoots" },
  { email: "seed-marketer10@ezzsearch.local", newNickname: "emma_mkt" },
];

async function main() {
  for (const { email, newNickname } of RENAMES) {
    const userRes = await notion.dataSources.query({
      data_source_id: usersDataSourceId!,
      filter: { property: USER_PROPS.title, title: { equals: email } },
      page_size: 1,
    });
    const userPage = userRes.results.find(isFullPage);
    if (!userPage) {
      console.warn(`  건너뜀 — 계정을 찾지 못함: ${email}`);
      continue;
    }

    await notion.pages.update({
      page_id: userPage.id,
      properties: {
        [USER_PROPS.nickname]: {
          type: "rich_text",
          rich_text: [{ type: "text", text: { content: newNickname } }],
        },
      },
    });
    console.log(`계정 닉네임 변경: ${email} -> ${newNickname}`);

    // 이 계정(작성자ID)이 쓴 게시글 전부의 작성자닉네임 스냅샷도 갱신.
    const postsRes = await notion.dataSources.query({
      data_source_id: postsDataSourceId!,
      filter: { property: BOARD_POST_PROPS.authorId, rich_text: { equals: userPage.id } },
      page_size: 100,
    });
    const posts = postsRes.results.filter(isFullPage);
    for (const post of posts) {
      await notion.pages.update({
        page_id: post.id,
        properties: {
          [BOARD_POST_PROPS.authorNickname]: {
            type: "rich_text",
            rich_text: [{ type: "text", text: { content: newNickname } }],
          },
        },
      });
    }
    console.log(`  게시글 ${posts.length}건 작성자닉네임 갱신`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Rename script failed:", err);
  process.exit(1);
});
