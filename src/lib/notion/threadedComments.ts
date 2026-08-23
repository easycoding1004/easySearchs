import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";

// 정책정보 게시판(POLICY_COMMENT_PROPS)과 핫딜정보 게시판(HOTDEAL_COMMENT_PROPS)
// 둘 다 댓글 스키마가 완전히 동일해서(내용/작성자닉네임/소속게시글/부모댓글ID/
// 작성일시) 공용 라이브러리로 뺌 — 두 곳 다 이 함수들을 데이터소스ID와 속성
// 이름만 넘겨서 그대로 씀. 대댓글은 Notion relation 자기참조 대신 부모댓글
// 페이지 ID를 rich_text로 저장하고, 트리 구성은 전부 클라이언트에서 함(한
// 게시글의 댓글 전체를 한 번에 가져오는 걸 전제 — 게시판 규모에서 무리 없음).

export interface ThreadedCommentPropNames {
  title: string;
  authorNickname: string;
  post: string;
  parentCommentId: string;
  postedAt: string;
}

export interface ThreadedComment {
  id: string;
  content: string;
  authorNickname: string;
  parentCommentId: string | null;
  createdAt: string;
  replies: ThreadedComment[];
}

function richText(value: PageObjectResponse["properties"][string] | undefined): string {
  return value?.type === "rich_text" ? value.rich_text.map((t) => t.plain_text).join("") : "";
}

function parseFlatComment(page: PageObjectResponse, props: ThreadedCommentPropNames): Omit<ThreadedComment, "replies"> {
  const p = page.properties;
  const titleProp = p[props.title];
  const content = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";
  const parentCommentId = richText(p[props.parentCommentId]) || null;
  const postedAtProp = p[props.postedAt];
  const createdAt = postedAtProp?.type === "date" ? postedAtProp.date?.start ?? "" : "";

  return {
    id: page.id,
    content,
    authorNickname: richText(p[props.authorNickname]),
    parentCommentId,
    createdAt,
  };
}

// 평평한 댓글 목록을 부모댓글ID 기준으로 트리로 묶음 — 작성일시 오름차순
// 유지(각 depth 안에서도 먼저 쓴 게 먼저 나오게).
export function buildCommentTree(flat: Omit<ThreadedComment, "replies">[]): ThreadedComment[] {
  const byId = new Map<string, ThreadedComment>(flat.map((c) => [c.id, { ...c, replies: [] }]));
  const roots: ThreadedComment[] = [];

  for (const comment of byId.values()) {
    if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
      byId.get(comment.parentCommentId)!.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }
  return roots;
}

export async function createThreadedComment(
  dataSourceId: string,
  props: ThreadedCommentPropNames,
  input: { postId: string; content: string; authorNickname: string; parentCommentId?: string | null }
): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: {
      [props.title]: { type: "title", title: [{ type: "text", text: { content: input.content } }] },
      [props.authorNickname]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.authorNickname } }],
      },
      [props.post]: { type: "relation", relation: [{ id: input.postId }] },
      [props.parentCommentId]: {
        type: "rich_text",
        rich_text: input.parentCommentId ? [{ type: "text", text: { content: input.parentCommentId } }] : [],
      },
      [props.postedAt]: { type: "date", date: { start: new Date().toISOString() } },
    },
  });
  return page.id;
}

export async function getThreadedCommentsForPost(
  dataSourceId: string,
  props: ThreadedCommentPropNames,
  postProp: string,
  postId: string
): Promise<ThreadedComment[]> {
  const flat: Omit<ThreadedComment, "replies">[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: { property: postProp, relation: { contains: postId } },
      sorts: [{ property: props.postedAt, direction: "ascending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    flat.push(...res.results.filter(isFullPage).map((page) => parseFlatComment(page, props)));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return buildCommentTree(flat);
}
