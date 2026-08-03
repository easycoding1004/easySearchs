import { NextResponse } from "next/server";
import { setNaverBlogId } from "@/lib/notion/users";
import { getCurrentUser } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

// blog.naver.com/{id}의 슬러그 형식(영문/숫자/-/_, 1~40자). 빈 문자열은
// "지우기"로 허용.
const NAVER_BLOG_ID_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;

// /api/write와 별도 라우트로 둔 이유: /api/write는 하루 1회 제한이 걸린
// 유료 Claude 호출 엔드포인트라 이 필드 저장(무료, 여러 번 고칠 수 있어야 함)을
// 거기 얹으면 제한 로직과 뒤엉킴 — 계정 설정 저장은 별개 관심사로 분리.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let naverBlogId: string;
  try {
    const body = await request.json();
    naverBlogId = typeof body.naverBlogId === "string" ? body.naverBlogId.trim() : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (naverBlogId && !NAVER_BLOG_ID_PATTERN.test(naverBlogId)) {
    return NextResponse.json(
      { error: "네이버 블로그 아이디 형식이 올바르지 않아요." },
      { status: 400 }
    );
  }

  try {
    await setNaverBlogId(user.pageId, naverBlogId);
    return NextResponse.json({ ok: true, naverBlogId });
  } catch (err) {
    console.error("[POST /api/write/naver-blog-id] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "저장에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
