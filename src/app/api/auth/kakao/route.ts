import { NextResponse } from "next/server";
import { issueOAuthState } from "@/lib/auth/socialAuth";

const SITE_URL = "https://ezzsearch.com";

export async function GET(request: Request) {
  const clientId = process.env.KAKAO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "카카오 로그인이 아직 설정되지 않았어요." }, { status: 503 });
  }

  const redirectTo = new URL(request.url).searchParams.get("redirect") ?? undefined;
  const state = await issueOAuthState(redirectTo);
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${SITE_URL}/api/auth/kakao/callback`);
  url.searchParams.set("state", state);
  // 사업자 전환 없이는 이메일 동의항목을 못 씀 — 닉네임은 기본 제공 항목이라
  // 대신 표시용 이름으로 쓴다 (CLAUDE.md §16 참고).
  url.searchParams.set("scope", "profile_nickname");

  return NextResponse.redirect(url.toString());
}
