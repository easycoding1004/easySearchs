import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { USER_PROPS, SUBSCRIPTION_STATUS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const usersDataSourceId = process.env.NOTION_USERS_DB_ID;

if (!notionToken || !usersDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_USERS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: adds 토스페이먼츠 월 구독제 관련 속성을 기존 사용자 계정
// DB에 추가함(CLAUDE.md 신규 섹션 참고). Additive only — 기존 속성/데이터는
// 그대로 둠. select 속성(구독상태)은 새 값을 써도 옵션이 자동 생성되지 않는다는
// 걸 §CLAUDE.md 18.1에서 실측으로 확인했으므로, 여기서 무료/유료 옵션을 미리
// 만들어둔다.
async function main() {
  console.log("Adding subscription properties to 사용자 계정...");
  await notion.dataSources.update({
    data_source_id: usersDataSourceId!,
    properties: {
      [USER_PROPS.subscriptionStatus]: {
        type: "select",
        select: {
          options: [{ name: SUBSCRIPTION_STATUS.free }, { name: SUBSCRIPTION_STATUS.paid }],
        },
      },
      [USER_PROPS.cancelPending]: { type: "checkbox", checkbox: {} },
      [USER_PROPS.tossCustomerKey]: { type: "rich_text", rich_text: {} },
      [USER_PROPS.tossBillingKey]: { type: "rich_text", rich_text: {} },
      [USER_PROPS.nextBillingDate]: { type: "date", date: {} },
      [USER_PROPS.freeUsesUsed]: { type: "number", number: { format: "number" } },
      [USER_PROPS.monthlyUsesUsed]: { type: "number", number: { format: "number" } },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add subscription properties:", err);
  process.exit(1);
});
