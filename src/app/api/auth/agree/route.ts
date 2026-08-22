import { NextResponse } from "next/server";
import { consumePendingSignup } from "@/lib/auth/socialAuth";
import { createSocialUser, setSession } from "@/lib/notion/users";
import { AUTH_PROVIDER } from "@/lib/notion/schema";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const KNOWN_PROVIDERS = new Set(Object.values(AUTH_PROVIDER));

// /signup/agree 화면에서 "동의하고 가입하기"를 누르면 여기로 옴. 소셜 로그인
// 콜백이 심어둔 pending-signup 쿠키(§CLAUDE.md 19 — issuePendingSignup)를
// 읽어 실제 계정을 생성 — 이 라우트가 createSocialUser()의 유일한 호출부라,
// 계정이 존재한다는 것 자체가 곧 이용약관·개인정보처리방침에 동의했다는
// 뜻이 됨(users.ts의 termsAgreedAt 참고).
export async function POST(request: Request) {
  const pending = await consumePendingSignup();
  if (!pending) {
    return NextResponse.json(
      { error: "가입 요청이 만료됐어요. 처음부터 다시 로그인해 주세요." },
      { status: 400 }
    );
  }
  if (!KNOWN_PROVIDERS.has(pending.provider as (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER])) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  let body: { agreedTerms?: boolean; agreedPrivacy?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (!body.agreedTerms || !body.agreedPrivacy) {
    return NextResponse.json(
      { error: "이용약관과 개인정보처리방침에 모두 동의해야 가입할 수 있어요." },
      { status: 400 }
    );
  }

  try {
    const provider = pending.provider as (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];
    const pageId = await createSocialUser(pending.email, provider, pending.providerId);
    const sessionToken = await setSession(pageId);

    const response = NextResponse.json({ ok: true, redirectTo: pending.redirectTo });
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    console.error("[POST /api/auth/agree] failed:", getErrorMessage(err), err);
    return NextResponse.json(
      { error: "가입에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }
}
