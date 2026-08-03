import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDataSource } from "@notionhq/client";
import { USER_PROPS, AUTH_PROVIDER } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const usersDataSourceId = process.env.NOTION_USERS_DB_ID;

if (!notionToken || !usersDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_USERS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: 실측 확인 결과, Notion select 속성은 이 프로젝트의 다른
// 곳들(§CLAUDE.md 여러 군데)에서 추정했던 것과 달리 "새 값을 쓰면 옵션이
// 자동 생성"되지 않음 — 구글 로그인 시도가 전부
// `select option "구글" not found for property "가입방식"` 에러로 실패하고
// 있었음. 기존 옵션(이메일/네이버/카카오)이 API 업데이트로 사라지지 않도록,
// 현재 옵션 전체를 먼저 읽어온 뒤 "구글"만 추가해서 다시 쓴다(교체가 아니라
// 항상 전체 목록을 보내는 안전한 방식).
async function main() {
  console.log("Fetching current 가입방식 options...");
  const dataSource = await notion.dataSources.retrieve({ data_source_id: usersDataSourceId! });
  if (!isFullDataSource(dataSource)) {
    throw new Error("Notion returned a partial response for 사용자 계정's data source.");
  }
  const prop = dataSource.properties[USER_PROPS.authProvider];
  if (prop?.type !== "select") {
    throw new Error(`Expected "${USER_PROPS.authProvider}" to be a select property, got: ${prop?.type}`);
  }

  const existingNames = prop.select.options.map((o) => o.name);
  console.log("Existing options:", existingNames.join(", "));

  if (existingNames.includes(AUTH_PROVIDER.google)) {
    console.log(`"${AUTH_PROVIDER.google}" already present — nothing to do.`);
    return;
  }

  const nextOptions = [...prop.select.options.map((o) => ({ name: o.name })), { name: AUTH_PROVIDER.google }];

  console.log(`Adding "${AUTH_PROVIDER.google}" option...`);
  await notion.dataSources.update({
    data_source_id: usersDataSourceId!,
    properties: {
      [USER_PROPS.authProvider]: { select: { options: nextOptions } },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add 구글 option:", err);
  process.exit(1);
});
