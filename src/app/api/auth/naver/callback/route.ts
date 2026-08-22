import { NextResponse } from "next/server";
import { findUserByProvider, setSession } from "@/lib/notion/users";
import { AUTH_PROVIDER } from "@/lib/notion/schema";
import { verifyAndConsumeOAuthState, issuePendingSignup } from "@/lib/auth/socialAuth";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

const SITE_URL = "https://ezzsearch.com";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface NaverProfileResponse {
  resultcode: string;
  response?: { id: string; email?: string };
}

function redirectWithError(message: string): NextResponse {
  const url = new URL(`${SITE_URL}/write`);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const clientId = process.env.NAVER_LOGIN_CLIENT_ID;
  const clientSecret = process.env.NAVER_LOGIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectWithError("네이버 로그인이 아직 설정되지 않았어요.");
  }
  const { ok: stateOk, redirectTo } = await verifyAndConsumeOAuthState(state);
  if (!code || !stateOk) {
    return redirectWithError("로그인 요청이 유효하지 않아요. 다시 시도해 주세요.");
  }

  try {
    const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
    tokenUrl.searchParams.set("grant_type", "authorization_code");
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("state", state ?? "");

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string | undefined;
    if (!accessToken) throw new Error(`네이버 토큰 발급 실패: ${JSON.stringify(tokenData)}`);

    const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileData = (await profileRes.json()) as NaverProfileResponse;
    if (profileData.resultcode !== "00" || !profileData.response) {
      throw new Error(`네이버 프로필 조회 실패: ${JSON.stringify(profileData)}`);
    }

    const { id: providerId, email } = profileData.response;
    const existingUser = await findUserByProvider(AUTH_PROVIDER.naver, providerId);

    if (!existingUser) {
      // 신규 계정 — 바로 만들지 않고 이용약관·개인정보처리방침 동의를 먼저
      // 받음(CLAUDE.md §19 참고). 실제 계정 생성은 /api/auth/agree에서.
      await issuePendingSignup({
        provider: AUTH_PROVIDER.naver,
        providerId,
        email: email ?? `naver_${providerId}`,
        redirectTo,
      });
      return NextResponse.redirect(`${SITE_URL}/signup/agree`);
    }

    const sessionToken = await setSession(existingUser.pageId);
    const response = NextResponse.redirect(`${SITE_URL}${redirectTo}`);
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    console.error("[GET /api/auth/naver/callback] failed:", getErrorMessage(err), err);
    return redirectWithError("네이버 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}
