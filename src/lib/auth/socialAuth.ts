import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

// Short-lived cookie holding the OAuth `state` value between the redirect-out
// and the provider's callback — prevents CSRF (a callback with a state that
// doesn't match this cookie is rejected). 10 minutes is generous for a login
// flow; no reason to keep it around longer.
const STATE_COOKIE = "write_oauth_state";
const STATE_MAX_AGE_SECONDS = 10 * 60;
const DEFAULT_REDIRECT = "/write";

interface OAuthStatePayload {
  state: string;
  redirectTo: string;
}

// "/"로 시작하지 않거나 "//"로 시작하는(프로토콜 상대 URL — 다른 도메인으로
// 리다이렉트시키는 오픈 리다이렉트 공격 벡터) 값은 거부 — redirectTo는
// 클라이언트가 쿼리 파라미터로 보낸 값이라 신뢰할 수 없음.
function sanitizeRedirect(path: string): string {
  if (path.startsWith("/") && !path.startsWith("//")) return path;
  return DEFAULT_REDIRECT;
}

// 2026-08 — 로그인 시스템이 /write 전용에서 공유(게시판 등)로 확장되면서,
// 로그인을 어느 페이지에서 시작했는지 기억해뒀다가 콜백 성공 시 그 페이지로
// 돌려보내야 함(안 그러면 게시판 글쓰기 페이지에서 구글 로그인을 눌러도
// 로그인 후 엉뚱하게 /write로 이동함). CSRF state 값과 같은 쿠키에 같이
// 담아서 별도 쿠키를 늘리지 않음.
export async function issueOAuthState(redirectTo: string = DEFAULT_REDIRECT): Promise<string> {
  const state = randomUUID();
  const store = await cookies();
  const payload: OAuthStatePayload = { state, redirectTo: sanitizeRedirect(redirectTo) };
  store.set(STATE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  return state;
}

export async function verifyAndConsumeOAuthState(
  receivedState: string | null
): Promise<{ ok: boolean; redirectTo: string }> {
  const store = await cookies();
  const raw = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  if (!raw || !receivedState) return { ok: false, redirectTo: DEFAULT_REDIRECT };
  try {
    const payload = JSON.parse(raw) as OAuthStatePayload;
    return { ok: payload.state === receivedState, redirectTo: payload.redirectTo || DEFAULT_REDIRECT };
  } catch {
    return { ok: false, redirectTo: DEFAULT_REDIRECT };
  }
}
