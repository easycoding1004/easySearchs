import { NextResponse } from "next/server";
import { findUserByVerificationToken, markEmailVerified, setSession } from "@/lib/notion/users";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_REDIRECT = "/write";

// AgreeForm.tsx의 sanitizeRedirect와 같은 원칙 — 클라이언트가 준 값이라
// 오픈 리다이렉트 벡터가 되지 않도록 내부 경로만 허용.
function sanitizeRedirect(path: string | null): string {
  if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  return DEFAULT_REDIRECT;
}

// 이메일 인증 링크 도착지 — 인증 메일의 링크를 누르면 여기로 옴. 인증
// 완료와 동시에 바로 로그인시켜서(세션 쿠키 발급) 다시 로그인 폼으로
// 돌아가지 않아도 되게 함(§CLAUDE.md 22).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const redirectTo = sanitizeRedirect(url.searchParams.get("redirect"));

  function fail(reason: string) {
    return NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));
  }

  if (!token) return fail("invalid_token");

  const user = await findUserByVerificationToken(token);
  if (!user) return fail("invalid_token");

  try {
    await markEmailVerified(user.pageId);
    const sessionToken = await setSession(user.pageId);

    const response = NextResponse.redirect(new URL(redirectTo, url.origin));
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    console.error("[GET /api/auth/verify] failed:", getErrorMessage(err), err);
    return fail("verify_failed");
  }
}
