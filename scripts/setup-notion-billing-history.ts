import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDatabase } from "@notionhq/client";
import { BILLING_HISTORY_PROPS, BILLING_STATUS } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

if (!notionToken || !parentPageId) {
  console.error(
    "Missing NOTION_TOKEN or NOTION_PARENT_PAGE_ID in .env.local. " +
      "Make sure the parent page is shared with your Integration first."
  );
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

function requireDataSourceId(db: Parameters<typeof isFullDatabase>[0], label: string): string {
  if (!isFullDatabase(db)) {
    throw new Error(
      `Notion returned a partial response for ${label} — the Integration may be missing read content capability.`
    );
  }
  return db.data_sources[0].id;
}

// 결제내역(토스페이먼츠 월 구독제, 2026-08 추가) — 최초 결제·매달 정기 청구
// 시도마다 1건씩 기록하는 감사 로그(CLAUDE.md 신규 섹션 참고).
async function main() {
  console.log("Creating 결제내역 (Billing History) database...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "결제내역" } }],
    initial_data_source: {
      properties: {
        [BILLING_HISTORY_PROPS.title]: { type: "title", title: {} },
        [BILLING_HISTORY_PROPS.authorId]: { type: "rich_text", rich_text: {} },
        [BILLING_HISTORY_PROPS.amount]: { type: "number", number: { format: "number" } },
        [BILLING_HISTORY_PROPS.status]: {
          type: "select",
          select: { options: [{ name: BILLING_STATUS.success }, { name: BILLING_STATUS.failure }] },
        },
        [BILLING_HISTORY_PROPS.orderId]: { type: "rich_text", rich_text: {} },
        [BILLING_HISTORY_PROPS.failureReason]: { type: "rich_text", rich_text: {} },
        [BILLING_HISTORY_PROPS.createdAt]: { type: "created_time", created_time: {} },
      },
    },
  });
  const dataSourceId = requireDataSourceId(db, "결제내역");
  console.log(`  DB id: ${db.id}`);
  console.log(`  Data source id: ${dataSourceId}`);

  console.log("\nDone. Paste this into .env.local:\n");
  console.log(`NOTION_BILLING_HISTORY_DB_ID=${dataSourceId}`);
}

main().catch((err) => {
  console.error("Notion billing-history setup failed:", err);
  process.exit(1);
});
