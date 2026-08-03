import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { setNickname } from "@/lib/notion/users";
import { createComment, getBoardPost } from "@/lib/notion/board";
import { getErrorMessage } from "@/lib/utils/errors";

const MAX_CONTENT_LENGTH = 1000;
const MAX_NICKNAME_LENGTH = 20;

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
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
  try {
    const json = await request.json();
    content = typeof json.content === "string" ? json.content.trim().slice(0, MAX_CONTENT_LENGTH) : "";
    nicknameInput = typeof json.nickname === "string" ? json.nickname.trim().slice(0, MAX_NICKNAME_LENGTH) : "";
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

  const post = await getBoardPost(postId);
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없어요." }, { status: 404 });
  }

  try {
    const commentId = await createComment({ postId, content, authorNickname });
    return NextResponse.json({ id: commentId }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/board/posts/[postId]/comments] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "댓글 작성에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
