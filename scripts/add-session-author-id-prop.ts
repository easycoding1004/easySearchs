import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { SESSION_PROPS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const sessionsDataSourceId = process.env.NOTION_SESSIONS_DB_ID;

if (!notionToken || !sessionsDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_SESSIONS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration (2026-08, "키워드 검색 기록을 계정에 새로 연결"): adds
// 작성자ID to the existing 검색 세션 database. Additive only — 기존 속성/
// 데이터는 그대로 둠, 기존 세션들은 이 값이 비어있는 채로 남음(과거엔 로그인
// 개념이 없었으니 소급 연결 불가).
async function main() {
  console.log("Adding 작성자ID property to 검색 세션...");
  await notion.dataSources.update({
    data_source_id: sessionsDataSourceId!,
    properties: {
      [SESSION_PROPS.authorId]: { type: "rich_text", rich_text: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add 작성자ID property:", err);
  process.exit(1);
});
