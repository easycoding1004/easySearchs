import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { setNickname } from "@/lib/notion/users";
import { createHotdealComment, getHotdealPost } from "@/lib/notion/hotdeal";
import { getErrorMessage } from "@/lib/utils/errors";
import { HOTDEAL_ENABLED } from "@/lib/constants";

const MAX_CONTENT_LENGTH = 1000;
const MAX_NICKNAME_LENGTH = 20;

// 정책정보 게시판의 댓글 라우트(§CLAUDE.md 신규 섹션)와 완전히 동일한 패턴 —
// 로그인+이메일인증 필요, 닉네임 없으면 1회 설정, parentCommentId로 대댓글.
export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  // 2026-08 재설계 — 핫딜 노출 종료(HOTDEAL_ENABLED). UI만 막고 API가 열려
  // 있는 반쪽 잠금이 되지 않도록 페이지와 같은 플래그로 함께 잠금.
  if (!HOTDEAL_ENABLED) {
    return NextResponse.json({ error: "지금은 이용할 수 없는 기능이에요." }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json({ error: "이메일 인증을 먼저 완료해 주세요." }, { status: 403 });
  }

  const { postId } = await params;

  let content: string;
  let nicknameInput: string;
  let parentCommentId: string | null;
  try {
    const json = await request.json();
    content = typeof json.content === "string" ? json.content.trim().slice(0, MAX_CONTENT_LENGTH) : "";
    nicknameInput = typeof json.nickname === "string" ? json.nickname.trim().slice(0, MAX_NICKNAME_LENGTH) : "";
    parentCommentId = typeof json.parentCommentId === "string" && json.parentCommentId ? json.parentCommentId : null;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "댓글 내용을 입력해 주세요." }, { status: 400 });
  }

  let authorNickname = user.nickname;
  if (!authorNickname) {
    if (!nicknameInput) {
      return NextResponse.json({ error: "게시판에서 쓸 닉네임을 입력해 주세요." }, { status: 400 });
    }
    await setNickname(user.pageId, nicknameInput);
    authorNickname = nicknameInput;
  }

  const post = await getHotdealPost(postId);
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없어요." }, { status: 404 });
  }

  try {
    const commentId = await createHotdealComment({ postId, content, authorNickname, parentCommentId });
    return NextResponse.json({ id: commentId }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/hotdeal/[postId]/comments] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "댓글 작성에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
