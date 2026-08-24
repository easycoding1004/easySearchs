import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

// Short-lived cookie holding the OAuth `state` value between the redirect-out
// and the provider's callback — prevents CSRF (a callback with a state that
// doesn't match this cookie is rejected). 10 minutes is generous for a login
// flow; no reason to keep it around longer.
const STATE_COOKIE = "write_oauth_state";
const STATE_MAX_AGE_SECONDS = 10 * 60;
const DEFAULT_REDIRECT = "/";

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

// 2026-08 추가(약관 동의 기반 가입 절차) — 소셜 로그인 콜백이 처음 보는
// providerId를 만나면 바로 createSocialUser()를 부르지 않고, 실제 계정
// 생성에 필요한 정보(가입방식/소셜ID/이메일·표시이름/원래 목적지)를 이
// httpOnly 쿠키에 잠깐 담아둔 뒤 /signup/agree로 보낸다. 클라이언트 JS가
// 절대 못 읽고 못 바꾸는 값이라(같은 STATE_COOKIE와 동일한 신뢰 모델) 별도
// 서명/CSRF 토큰 없이도 위조가 안 됨 — 서버가 실제 OAuth 검증을 마친 뒤에만
// 이 쿠키를 세팅하기 때문.
const PENDING_SIGNUP_COOKIE = "write_pending_signup";
const PENDING_SIGNUP_MAX_AGE_SECONDS = 10 * 60;

export interface PendingSignup {
  provider: string;
  providerId: string;
  email: string;
  redirectTo: string;
}

export async function issuePendingSignup(payload: PendingSignup): Promise<void> {
  const store = await cookies();
  store.set(PENDING_SIGNUP_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_SIGNUP_MAX_AGE_SECONDS,
  });
}

// 소비(읽고 즉시 삭제) — /signup/agree 화면에서 동의를 완료해 실제 계정을
// 만들 때 한 번만 쓰임. 쿠키가 없거나(만료·이미 소비됨) 손상됐으면 null —
// 호출부가 "가입 요청이 만료됐어요, 처음부터 다시 시도해 주세요"로 안내함.
export async function consumePendingSignup(): Promise<PendingSignup | null> {
  const store = await cookies();
  const raw = store.get(PENDING_SIGNUP_COOKIE)?.value;
  store.delete(PENDING_SIGNUP_COOKIE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingSignup;
  } catch {
    return null;
  }
}
