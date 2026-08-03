import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminAuthed } from "@/lib/auth/adminAuth";
import { getBoardPost, updateBoardPost, deleteBoardPost } from "@/lib/notion/board";
import { getErrorMessage } from "@/lib/utils/errors";

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 20000;

// 작성 당사자 또는 /admin 비밀번호 쿠키로 인증된 운영자만 수정·삭제 가능
// (§CLAUDE.md 18 — 나머지는 전부 로그인 사용자 자기 자신에게만 열려 있음).
async function canManagePost(authorId: string): Promise<boolean> {
  const [user, admin] = await Promise.all([getCurrentUser(), isAdminAuthed()]);
  if (admin) return true;
  return !!user && user.pageId === authorId;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const post = await getBoardPost(postId);
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없어요." }, { status: 404 });
  }
  if (!(await canManagePost(post.authorId))) {
    return NextResponse.json({ error: "수정 권한이 없어요." }, { status: 403 });
  }

  let title: string;
  let body: string;
  try {
    const json = await request.json();
    title = typeof json.title === "string" ? json.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
    body = typeof json.body === "string" ? json.body.trim().slice(0, MAX_BODY_LENGTH) : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (!title || !body) {
    return NextResponse.json({ error: "제목과 본문을 입력해 주세요." }, { status: 400 });
  }

  try {
    await updateBoardPost(postId, { title, body });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/board/posts/[postId]] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "게시글 수정에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const post = await getBoardPost(postId);
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없어요." }, { status: 404 });
  }
  if (!(await canManagePost(post.authorId))) {
    return NextResponse.json({ error: "삭제 권한이 없어요." }, { status: 403 });
  }

  try {
    await deleteBoardPost(postId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/board/posts/[postId]] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "게시글 삭제에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
