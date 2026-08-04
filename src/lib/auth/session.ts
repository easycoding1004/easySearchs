import { cookies } from "next/headers";
import { findUserBySessionToken, type User } from "@/lib/notion/users";

export const SESSION_COOKIE = "write_session";

// 2026-08 — 원래 /write 전용으로 짜여 있던 로그인 시스템을 게시판 기능도
// 같이 쓸 수 있게 공유 위치(lib/auth/)로 옮김(§CLAUDE.md 14 — 2개 이상
// 기능이 쓰면 공유). SESSION_COOKIE 값("write_session")은 이름을 바꾸면
// 지금 로그인돼 있는 기존 사용자 세션이 전부 끊기므로 그대로 유지 — 새
// 기능(게시판)도 이 쿠키를 그대로 읽고 씀.
//
// 이메일+비밀번호 로그인(hashPassword/verifyPassword/isValidEmail 등)은
// 2026-08에 완전히 제거됨 — 소셜 로그인(네이버/카카오/구글) 3종만 남음
// (사용자 요청: 소셜은 이미 이메일 인증 없이 바로 가입되는데 이메일+비밀번호만
// 별도 인증 절차를 거치게 하는 게 일관성이 없다는 이유). 되살리려면 이 커밋
// 이전 버전을 참고할 것.
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserBySessionToken(token);
}
