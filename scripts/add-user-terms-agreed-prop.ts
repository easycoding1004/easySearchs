import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { USER_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const usersDataSourceId = process.env.NOTION_USERS_DB_ID;

if (!notionToken || !usersDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_USERS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: adds 약관동의일시 to the existing 사용자 계정 database
// (2026-08, 약관 동의 기반 가입 절차) — 소셜 로그인 콜백이 신규 계정을 바로
// 만들지 않고 /signup/agree에서 이용약관·개인정보처리방침 동의를 받은
// 시점에만 계정을 생성하도록 바뀌면서, 그 동의 시점을 기록해두는 속성.
// Additive only — 기존 속성/데이터는 그대로 둠.
async function main() {
  console.log("Adding 약관동의일시 property to 사용자 계정...");
  await notion.dataSources.update({
    data_source_id: usersDataSourceId!,
    properties: {
      [USER_PROPS.termsAgreedAt]: { type: "date", date: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add 약관동의일시 property:", err);
  process.exit(1);
});
