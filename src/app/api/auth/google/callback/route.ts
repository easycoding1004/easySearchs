import { NextResponse } from "next/server";
import { findUserByProvider, createSocialUser, setSession } from "@/lib/notion/users";
import { AUTH_PROVIDER } from "@/lib/notion/schema";
import { verifyAndConsumeOAuthState } from "@/lib/auth/socialAuth";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

const SITE_URL = "https://ezzsearch.com";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface GoogleProfileResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
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

  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectWithError("구글 로그인이 아직 설정되지 않았어요.");
  }

  const { ok: stateOk, redirectTo } = await verifyAndConsumeOAuthState(state);
  if (!code || !stateOk) {
    return redirectWithError("로그인 요청이 유효하지 않아요. 다시 시도해 주세요.");
  }

  try {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${SITE_URL}/api/auth/google/callback`,
      code,
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string | undefined;
    if (!accessToken) throw new Error(`구글 토큰 발급 실패: ${JSON.stringify(tokenData)}`);

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileData = (await profileRes.json()) as GoogleProfileResponse;
    if (!profileData.sub) throw new Error(`구글 프로필 조회 실패: ${JSON.stringify(profileData)}`);

    const providerId = profileData.sub;
    const existingUser = await findUserByProvider(AUTH_PROVIDER.google, providerId);
    const pageId = existingUser
      ? existingUser.pageId
      : await createSocialUser(profileData.email ?? `google_${providerId}`, AUTH_PROVIDER.google, providerId);

    const sessionToken = await setSession(pageId);
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
    console.error("[GET /api/auth/google/callback] failed:", getErrorMessage(err), err);
    return redirectWithError("구글 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}
