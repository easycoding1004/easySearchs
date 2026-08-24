import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullPage } from "@notionhq/client";
import { USER_PROPS, AUTH_PROVIDER } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const usersDataSourceId = process.env.NOTION_USERS_DB_ID;
if (!notionToken || !usersDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_USERS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// 2026-08 추가(사용자 요청 — "게시자의 닉네임은 루리웹 닉네임 말고 우리
// 사이트에 가입자의 닉네임으로") — 실제 일반 회원 계정을 임의로 골라 그
// 사람 이름으로 자동수집 글을 게시하는 건 본인 동의 없이 프라이버시를
// 침해하는 것이라(§CLAUDE.md 18.7.1의 게시판 데모 시드는 가짜 페르소나를
// 써서 이 문제가 없었음), 사용자와 논의 후 **전용 표시계정을 새로 하나
// 만드는 쪽**으로 확정함 — 실제 로그인은 안 되는 계정(비밀번호 없음, 가짜
// 도메인 이메일)이고 자동수집 글의 작성자 표시용으로만 씀.
// seed-board-demo-content.ts와 같은 이유로 dotenv config() 이후 직접 만든
// Client 인스턴스만 쓴다(lib/notion/*.ts를 import하면 호이스팅 문제 재발).
const EMAIL = "hotdeal-curator@ezzsearch.local";
const NICKNAME = "dealscout";

async function main() {
  const existing = await notion.dataSources.query({
    data_source_id: usersDataSourceId!,
    filter: { property: USER_PROPS.title, title: { equals: EMAIL } },
    page_size: 1,
  });
  const found = existing.results.find(isFullPage);
  if (found) {
    console.log(`이미 존재: ${NICKNAME} (${EMAIL}) — pageId: ${found.id}`);
    return;
  }

  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: usersDataSourceId! },
    properties: {
      [USER_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: EMAIL } }] },
      [USER_PROPS.emailVerified]: { type: "checkbox", checkbox: true },
      [USER_PROPS.authProvider]: { type: "select", select: { name: AUTH_PROVIDER.email } },
      [USER_PROPS.createdAt]: { type: "date", date: { start: new Date().toISOString() } },
      [USER_PROPS.nickname]: { type: "rich_text", rich_text: [{ type: "text", text: { content: NICKNAME } }] },
    },
  });
  console.log(`생성: ${NICKNAME} (${EMAIL}) — pageId: ${page.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
