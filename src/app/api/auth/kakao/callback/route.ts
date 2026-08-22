import { NextResponse } from "next/server";
import { findUserByProvider, setSession } from "@/lib/notion/users";
import { AUTH_PROVIDER } from "@/lib/notion/schema";
import { verifyAndConsumeOAuthState, issuePendingSignup } from "@/lib/auth/socialAuth";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

const SITE_URL = "https://ezzsearch.com";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface KakaoProfileResponse {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: { nickname?: string };
  };
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

  const clientId = process.env.KAKAO_CLIENT_ID;
  if (!clientId) {
    return redirectWithError("카카오 로그인이 아직 설정되지 않았어요.");
  }
  const { ok: stateOk, redirectTo } = await verifyAndConsumeOAuthState(state);
  if (!code || !stateOk) {
    return redirectWithError("로그인 요청이 유효하지 않아요. 다시 시도해 주세요.");
  }

  try {
    // client_secret은 카카오 앱 설정에서 "Client Secret" 사용을 켰을 때만
    // 필요 — 꺼져 있으면 KAKAO_CLIENT_SECRET을 안 넣어도 됨.
    const clientSecret = process.env.KAKAO_CLIENT_SECRET;
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: `${SITE_URL}/api/auth/kakao/callback`,
      code,
    });
    if (clientSecret) tokenParams.set("client_secret", clientSecret);

    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string | undefined;
    if (!accessToken) throw new Error(`카카오 토큰 발급 실패: ${JSON.stringify(tokenData)}`);

    const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileData = (await profileRes.json()) as KakaoProfileResponse;
    if (!profileData.id) throw new Error(`카카오 프로필 조회 실패: ${JSON.stringify(profileData)}`);

    const providerId = String(profileData.id);
    // 사업자 미전환 상태라 이메일 동의항목을 못 받아옴 — 닉네임(기본 제공
    // 항목)을 대신 표시 이름으로 씀. 소셜 계정은 (가입방식, 소셜ID)로
    // 조회하지 title/이메일로 조회하지 않으므로, 닉네임이 겹치거나 없어도
    // 조회 로직에는 영향 없음(순수 표시용).
    const displayName =
      profileData.kakao_account?.email ?? profileData.kakao_account?.profile?.nickname ?? "카카오 사용자";
    const existingUser = await findUserByProvider(AUTH_PROVIDER.kakao, providerId);

    if (!existingUser) {
      // 신규 계정 — 바로 만들지 않고 이용약관·개인정보처리방침 동의를 먼저
      // 받음(CLAUDE.md §19 참고). 실제 계정 생성은 /api/auth/agree에서.
      await issuePendingSignup({
        provider: AUTH_PROVIDER.kakao,
        providerId,
        email: displayName,
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
    console.error("[GET /api/auth/kakao/callback] failed:", getErrorMessage(err), err);
    return redirectWithError("카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}
