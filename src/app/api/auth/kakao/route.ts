import { NextResponse } from "next/server";
import { issueOAuthState } from "@/lib/write/socialAuth";

const SITE_URL = "https://ezzsearch.com";

export async function GET() {
  const clientId = process.env.KAKAO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "카카오 로그인이 아직 설정되지 않았어요." }, { status: 503 });
  }

  const state = await issueOAuthState();
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${SITE_URL}/api/auth/kakao/callback`);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
