import { NextResponse } from "next/server";
import { issueOAuthState } from "@/lib/auth/socialAuth";

const SITE_URL = "https://ezzsearch.com";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "구글 로그인이 아직 설정되지 않았어요." }, { status: 503 });
  }

  const redirectTo = new URL(request.url).searchParams.get("redirect") ?? undefined;
  const state = await issueOAuthState(redirectTo);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${SITE_URL}/api/auth/google/callback`);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "openid email profile");

  return NextResponse.redirect(url.toString());
}
