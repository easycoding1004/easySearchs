import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDatabase, isFullDataSource } from "@notionhq/client";
import { HOTDEAL_POST_PROPS, HOTDEAL_COMMENT_PROPS, HOTDEAL_SOURCE } from "../src/lib/notion/schema";

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

async function renameAutoRelation(dataSourceId: string, label: string, newName: string) {
  console.log(`Renaming the auto-generated relation property on ${label} to ${newName}...`);
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  if (!isFullDataSource(dataSource)) {
    throw new Error(`Notion returned a partial response for ${label}'s data source.`);
  }
  const autoRelationEntry = Object.entries(dataSource.properties).find(([, prop]) => prop.type === "relation");
  if (!autoRelationEntry) {
    throw new Error(
      `Could not find the auto-generated relation property on ${label} — check the Notion UI and rename it to ${newName} manually.`
    );
  }
  const [autoRelationName] = autoRelationEntry;
  await notion.dataSources.update({
    data_source_id: dataSourceId,
    properties: { [autoRelationName]: { name: newName } },
  });
}

// 핫딜정보 게시판(`/hotdeal`, 2026-08 추가) — 회원이 직접 상품명·가격비교·
// 구매링크를 등록하는 커뮤니티형 게시판(§CLAUDE.md 신규 섹션 — 11번가·
// 쿠팡파트너스 API가 사업자 전용이라 자동화 대신 이 방식으로 전환).
async function main() {
  console.log("Creating 핫딜정보 게시글 (Hotdeal Posts) database...");
  const postsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "핫딜정보 게시글" } }],
    initial_data_source: {
      properties: {
        [HOTDEAL_POST_PROPS.title]: { type: "title", title: {} },
        [HOTDEAL_POST_PROPS.body]: { type: "rich_text", rich_text: {} },
        [HOTDEAL_POST_PROPS.modelName]: { type: "rich_text", rich_text: {} },
        [HOTDEAL_POST_PROPS.authorNickname]: { type: "rich_text", rich_text: {} },
        [HOTDEAL_POST_PROPS.authorId]: { type: "rich_text", rich_text: {} },
        [HOTDEAL_POST_PROPS.comparisons]: { type: "rich_text", rich_text: {} },
        [HOTDEAL_POST_PROPS.lowestPrice]: { type: "number", number: { format: "number" } },
        [HOTDEAL_POST_PROPS.source]: {
          type: "select",
          select: { options: Object.values(HOTDEAL_SOURCE).map((name) => ({ name })) },
        },
        [HOTDEAL_POST_PROPS.postedAt]: { type: "date", date: {} },
      },
    },
  });
  const postsDataSourceId = requireDataSourceId(postsDb, "핫딜정보 게시글");
  console.log(`  DB id: ${postsDb.id}`);
  console.log(`  Data source id: ${postsDataSourceId}`);

  console.log("Creating 핫딜정보 댓글 (Hotdeal Comments) database...");
  const commentsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "핫딜정보 댓글" } }],
    initial_data_source: {
      properties: {
        [HOTDEAL_COMMENT_PROPS.title]: { type: "title", title: {} },
        [HOTDEAL_COMMENT_PROPS.authorNickname]: { type: "rich_text", rich_text: {} },
        [HOTDEAL_COMMENT_PROPS.post]: {
          type: "relation",
          relation: { data_source_id: postsDataSourceId, type: "dual_property", dual_property: {} },
        },
        [HOTDEAL_COMMENT_PROPS.parentCommentId]: { type: "rich_text", rich_text: {} },
        [HOTDEAL_COMMENT_PROPS.postedAt]: { type: "date", date: {} },
      },
    },
  });
  const commentsDataSourceId = requireDataSourceId(commentsDb, "핫딜정보 댓글");
  console.log(`  DB id: ${commentsDb.id}`);
  console.log(`  Data source id: ${commentsDataSourceId}`);

  await renameAutoRelation(postsDataSourceId, "핫딜정보 게시글", "댓글");

  console.log("\nDone. Paste these into .env.local:\n");
  console.log(`NOTION_HOTDEAL_POSTS_DB_ID=${postsDataSourceId}`);
  console.log(`NOTION_HOTDEAL_COMMENTS_DB_ID=${commentsDataSourceId}`);
}

main().catch((err) => {
  console.error("Notion hotdeal-board setup failed:", err);
  process.exit(1);
});
