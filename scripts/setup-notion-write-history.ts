import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDatabase } from "@notionhq/client";
import { WRITE_HISTORY_PROPS } from "../src/lib/notion/schema";
import { BLOG_CATEGORIES } from "../src/lib/write/blogCategories";
import { STYLE_PRESET_OPTIONS, FONT_OPTIONS } from "../src/lib/write/blogTheme";

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

// AI 글쓰기 히스토리(`/write/history`, 2026-08 추가) — "이 버전으로 확정하기"
// 클릭 시점에 1건씩 쌓이는, 회원별 AI 블로그 자동글쓰기 적용 이력. select
// 속성(유형/스타일프리셋/레이아웃/폰트)은 Notion이 새 값을 써도 옵션을
// 자동 생성해주지 않으므로(§CLAUDE.md 18.1 구글 로그인 select 옵션 버그와
// 같은 함정) 실제 코드가 쓸 수 있는 값을 전부 미리 옵션으로 넣어둠.
async function main() {
  console.log("Creating AI 글쓰기 히스토리 (Write History) database...");
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "AI 글쓰기 히스토리" } }],
    initial_data_source: {
      properties: {
        [WRITE_HISTORY_PROPS.title]: { type: "title", title: {} },
        [WRITE_HISTORY_PROPS.body]: { type: "rich_text", rich_text: {} },
        [WRITE_HISTORY_PROPS.authorId]: { type: "rich_text", rich_text: {} },
        [WRITE_HISTORY_PROPS.authorNickname]: { type: "rich_text", rich_text: {} },
        [WRITE_HISTORY_PROPS.category]: {
          type: "select",
          select: { options: BLOG_CATEGORIES.map((c) => ({ name: c.id })) },
        },
        [WRITE_HISTORY_PROPS.sponsored]: { type: "checkbox", checkbox: {} },
        [WRITE_HISTORY_PROPS.tags]: { type: "rich_text", rich_text: {} },
        [WRITE_HISTORY_PROPS.stylePreset]: {
          type: "select",
          select: { options: STYLE_PRESET_OPTIONS.map((o) => ({ name: o.value })) },
        },
        [WRITE_HISTORY_PROPS.layout]: {
          type: "select",
          select: { options: [{ name: "표준형" }, { name: "매거진형" }, { name: "미니멀형" }] },
        },
        [WRITE_HISTORY_PROPS.accentColor]: { type: "rich_text", rich_text: {} },
        [WRITE_HISTORY_PROPS.font]: {
          type: "select",
          select: { options: FONT_OPTIONS.map((o) => ({ name: o.value })) },
        },
        [WRITE_HISTORY_PROPS.createdAt]: { type: "created_time", created_time: {} },
      },
    },
  });
  const dataSourceId = requireDataSourceId(db, "AI 글쓰기 히스토리");
  console.log(`  DB id: ${db.id}`);
  console.log(`  Data source id: ${dataSourceId}`);

  console.log("\nDone. Paste this into .env.local:\n");
  console.log(`NOTION_WRITE_HISTORY_DB_ID=${dataSourceId}`);
}

main().catch((err) => {
  console.error("Notion write-history setup failed:", err);
  process.exit(1);
});
