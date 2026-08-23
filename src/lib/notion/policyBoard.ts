import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { POLICY_POST_PROPS, POLICY_COMMENT_PROPS, type POLICY_CATEGORY } from "./schema";
import {
  createThreadedComment,
  getThreadedCommentsForPost,
  type ThreadedComment,
} from "./threadedComments";

export type PolicyCategory = (typeof POLICY_CATEGORY)[keyof typeof POLICY_CATEGORY];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function postsDataSourceId(): string {
  return requireEnv("NOTION_POLICY_POSTS_DB_ID");
}

function commentsDataSourceId(): string {
  return requireEnv("NOTION_POLICY_COMMENTS_DB_ID");
}

export interface PolicyPost {
  id: string;
  title: string;
  body: string;
  category: PolicyCategory | "";
  sourceUrl: string;
  organization: string;
  deadline: string; // ISO date, "" if none
  sourceId: string;
  postedAt: string;
  commentCount: number;
}

function richText(value: PageObjectResponse["properties"][string] | undefined): string {
  return value?.type === "rich_text" ? value.rich_text.map((t) => t.plain_text).join("") : "";
}

function parsePolicyPost(page: PageObjectResponse): PolicyPost {
  const props = page.properties;
  const titleProp = props[POLICY_POST_PROPS.title];
  const title = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  const categoryProp = props[POLICY_POST_PROPS.category];
  const category = categoryProp?.type === "select" ? (categoryProp.select?.name as PolicyCategory) ?? "" : "";

  const sourceUrlProp = props[POLICY_POST_PROPS.sourceUrl];
  const sourceUrl = sourceUrlProp?.type === "url" ? sourceUrlProp.url ?? "" : "";

  const deadlineProp = props[POLICY_POST_PROPS.deadline];
  const deadline = deadlineProp?.type === "date" ? deadlineProp.date?.start ?? "" : "";

  const postedAtProp = props[POLICY_POST_PROPS.postedAt];
  const postedAt = postedAtProp?.type === "date" ? postedAtProp.date?.start ?? "" : "";

  const commentCountProp = props[POLICY_POST_PROPS.commentCount];
  const commentCount = commentCountProp?.type === "relation" ? commentCountProp.relation.length : 0;

  return {
    id: page.id,
    title,
    body: richText(props[POLICY_POST_PROPS.body]),
    category,
    sourceUrl,
    organization: richText(props[POLICY_POST_PROPS.organization]),
    deadline,
    sourceId: richText(props[POLICY_POST_PROPS.sourceId]),
    postedAt,
    commentCount,
  };
}

// 기업마당 RSS를 매일 다시 훑을 때 이미 등록된 공고를 중복 게시하지 않기
// 위한 dedup 체크 — policyBoardJob.ts가 새 항목마다 먼저 이걸 부름.
export async function findPolicyPostBySourceId(sourceId: string): Promise<boolean> {
  const res = await notion.dataSources.query({
    data_source_id: postsDataSourceId(),
    filter: { property: POLICY_POST_PROPS.sourceId, rich_text: { equals: sourceId } },
    page_size: 1,
  });
  return res.results.length > 0;
}

export async function createPolicyPost(input: {
  title: string;
  body: string;
  category: PolicyCategory;
  sourceUrl: string;
  organization: string;
  deadline: string | null;
  sourceId: string;
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: postsDataSourceId() },
    properties: {
      [POLICY_POST_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: input.title } }] },
      [POLICY_POST_PROPS.body]: { type: "rich_text", rich_text: [{ type: "text", text: { content: input.body } }] },
      [POLICY_POST_PROPS.category]: { type: "select", select: { name: input.category } },
      [POLICY_POST_PROPS.sourceUrl]: { type: "url", url: input.sourceUrl || null },
      [POLICY_POST_PROPS.organization]: {
        type: "rich_text",
        rich_text: input.organization ? [{ type: "text", text: { content: input.organization } }] : [],
      },
      [POLICY_POST_PROPS.deadline]: { type: "date", date: input.deadline ? { start: input.deadline } : null },
      [POLICY_POST_PROPS.sourceId]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.sourceId } }],
      },
      [POLICY_POST_PROPS.postedAt]: { type: "date", date: { start: new Date().toISOString() } },
    },
  });
  return page.id;
}

export async function getPolicyPost(id: string): Promise<PolicyPost | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (!isFullPage(page) || page.archived) return null;
    return parsePolicyPost(page);
  } catch {
    return null;
  }
}

const PAGE_SIZE = 20;

// search는 제목(title 속성) 부분일치 — hotdeal.ts의 모델명 검색과 같은
// 원칙. category와 함께 걸리면 and로 묶음(§CLAUDE.md 15의 Notion 날짜 필터
// AND 버그와 다른 얘기 — 이건 select+title 조합이라 그 함정은 해당 없음).
export async function getPolicyPosts(
  cursor?: string,
  category?: PolicyCategory,
  search?: string
): Promise<{ posts: PolicyPost[]; nextCursor: string | null }> {
  const conditions = [];
  if (category) conditions.push({ property: POLICY_POST_PROPS.category, select: { equals: category } });
  if (search) conditions.push({ property: POLICY_POST_PROPS.title, title: { contains: search } });
  const filter = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : { and: conditions };

  const res = await notion.dataSources.query({
    data_source_id: postsDataSourceId(),
    filter,
    sorts: [{ property: POLICY_POST_PROPS.postedAt, direction: "descending" }],
    start_cursor: cursor,
    page_size: PAGE_SIZE,
  });
  return {
    posts: res.results.filter(isFullPage).map(parsePolicyPost),
    nextCursor: res.has_more ? (res.next_cursor ?? null) : null,
  };
}

export async function createPolicyComment(input: {
  postId: string;
  content: string;
  authorNickname: string;
  parentCommentId?: string | null;
}): Promise<string> {
  return createThreadedComment(commentsDataSourceId(), POLICY_COMMENT_PROPS, input);
}

export async function getCommentsForPolicyPost(postId: string): Promise<ThreadedComment[]> {
  return getThreadedCommentsForPost(commentsDataSourceId(), POLICY_COMMENT_PROPS, POLICY_COMMENT_PROPS.post, postId);
}
