import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDatabase, isFullDataSource } from "@notionhq/client";
import { BOARD_POST_PROPS, BOARD_COMMENT_PROPS } from "../src/lib/notion/schema";

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

// 게시판(`/board`, 2026-08 추가) — 자유게시판+댓글. 읽기는 로그인 없이
// 누구나, 쓰기는 회원만(CLAUDE.md §16 확장 로그인 재사용).
async function main() {
  console.log("Creating 게시판 게시글 (Board Posts) database...");
  const postsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "게시판 게시글" } }],
    initial_data_source: {
      properties: {
        [BOARD_POST_PROPS.title]: { type: "title", title: {} },
        [BOARD_POST_PROPS.body]: { type: "rich_text", rich_text: {} },
        [BOARD_POST_PROPS.authorNickname]: { type: "rich_text", rich_text: {} },
        [BOARD_POST_PROPS.authorId]: { type: "rich_text", rich_text: {} },
        [BOARD_POST_PROPS.images]: { type: "files", files: {} },
        [BOARD_POST_PROPS.createdAt]: { type: "created_time", created_time: {} },
      },
    },
  });
  const postsDataSourceId = requireDataSourceId(postsDb, "게시판 게시글");
  console.log(`  DB id: ${postsDb.id}`);
  console.log(`  Data source id: ${postsDataSourceId}`);

  console.log("Creating 게시판 댓글 (Board Comments) database...");
  const commentsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "게시판 댓글" } }],
    initial_data_source: {
      properties: {
        [BOARD_COMMENT_PROPS.title]: { type: "title", title: {} },
        [BOARD_COMMENT_PROPS.authorNickname]: { type: "rich_text", rich_text: {} },
        [BOARD_COMMENT_PROPS.post]: {
          type: "relation",
          relation: { data_source_id: postsDataSourceId, type: "dual_property", dual_property: {} },
        },
        [BOARD_COMMENT_PROPS.createdAt]: { type: "created_time", created_time: {} },
      },
    },
  });
  const commentsDataSourceId = requireDataSourceId(commentsDb, "게시판 댓글");
  console.log(`  DB id: ${commentsDb.id}`);
  console.log(`  Data source id: ${commentsDataSourceId}`);

  await renameAutoRelation(postsDataSourceId, "게시판 게시글", "댓글");

  console.log("\nDone. Paste these into .env.local:\n");
  console.log(`NOTION_BOARD_POSTS_DB_ID=${postsDataSourceId}`);
  console.log(`NOTION_BOARD_COMMENTS_DB_ID=${commentsDataSourceId}`);
}

main().catch((err) => {
  console.error("Notion board setup failed:", err);
  process.exit(1);
});
