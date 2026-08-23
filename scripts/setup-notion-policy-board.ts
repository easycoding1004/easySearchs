import { config } from "dotenv";
config({ path: ".env.local" });

import { Client, isFullDatabase, isFullDataSource } from "@notionhq/client";
import { POLICY_POST_PROPS, POLICY_COMMENT_PROPS, POLICY_CATEGORY } from "../src/lib/notion/schema";

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

// 소상공인 정책정보 게시판(`/policy-board`, 2026-08 추가) — 기업마당
// 오픈API를 매일 스케줄드 잡으로 조회해 자동 게시(policyBoardJob.ts).
// 댓글+대댓글은 board.ts와 다른 패턴(threadedComments.ts 참고) — 부모댓글은
// relation 자기참조 대신 rich_text로 저장하므로 여기선 일반 rich_text로
// 만들면 됨.
async function main() {
  console.log("Creating 정책정보 게시글 (Policy Posts) database...");
  const postsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "정책정보 게시글" } }],
    initial_data_source: {
      properties: {
        [POLICY_POST_PROPS.title]: { type: "title", title: {} },
        [POLICY_POST_PROPS.body]: { type: "rich_text", rich_text: {} },
        [POLICY_POST_PROPS.category]: {
          type: "select",
          select: { options: Object.values(POLICY_CATEGORY).map((name) => ({ name })) },
        },
        [POLICY_POST_PROPS.sourceUrl]: { type: "url", url: {} },
        [POLICY_POST_PROPS.organization]: { type: "rich_text", rich_text: {} },
        [POLICY_POST_PROPS.deadline]: { type: "date", date: {} },
        [POLICY_POST_PROPS.sourceId]: { type: "rich_text", rich_text: {} },
        [POLICY_POST_PROPS.postedAt]: { type: "date", date: {} },
      },
    },
  });
  const postsDataSourceId = requireDataSourceId(postsDb, "정책정보 게시글");
  console.log(`  DB id: ${postsDb.id}`);
  console.log(`  Data source id: ${postsDataSourceId}`);

  console.log("Creating 정책정보 댓글 (Policy Comments) database...");
  const commentsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId! },
    title: [{ type: "text", text: { content: "정책정보 댓글" } }],
    initial_data_source: {
      properties: {
        [POLICY_COMMENT_PROPS.title]: { type: "title", title: {} },
        [POLICY_COMMENT_PROPS.authorNickname]: { type: "rich_text", rich_text: {} },
        [POLICY_COMMENT_PROPS.post]: {
          type: "relation",
          relation: { data_source_id: postsDataSourceId, type: "dual_property", dual_property: {} },
        },
        [POLICY_COMMENT_PROPS.parentCommentId]: { type: "rich_text", rich_text: {} },
        [POLICY_COMMENT_PROPS.postedAt]: { type: "date", date: {} },
      },
    },
  });
  const commentsDataSourceId = requireDataSourceId(commentsDb, "정책정보 댓글");
  console.log(`  DB id: ${commentsDb.id}`);
  console.log(`  Data source id: ${commentsDataSourceId}`);

  await renameAutoRelation(postsDataSourceId, "정책정보 게시글", "댓글");

  console.log("\nDone. Paste these into .env.local:\n");
  console.log(`NOTION_POLICY_POSTS_DB_ID=${postsDataSourceId}`);
  console.log(`NOTION_POLICY_COMMENTS_DB_ID=${commentsDataSourceId}`);
}

main().catch((err) => {
  console.error("Notion policy-board setup failed:", err);
  process.exit(1);
});
