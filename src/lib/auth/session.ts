import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { findUserBySessionToken, type User } from "@/lib/notion/users";

export const SESSION_COOKIE = "write_session";

// 2026-08 — 원래 /write 전용으로 짜여 있던 로그인 시스템을 게시판 기능도
// 같이 쓸 수 있게 공유 위치(lib/auth/)로 옮김(§CLAUDE.md 14 — 2개 이상
// 기능이 쓰면 공유). SESSION_COOKIE 값("write_session")은 이름을 바꾸면
// 지금 로그인돼 있는 기존 사용자 세션이 전부 끊기므로 그대로 유지 — 새
// 기능(게시판)도 이 쿠키를 그대로 읽고 씀.
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserBySessionToken(token);
}

// 2026-08 부활(사용자 요청 — "ID PW 기입이 있는 로그인 페이지로 전면 변경") —
// 한 번 완전히 제거했던 이메일+비밀번호 로그인을 되살림(§CLAUDE.md 22 참고).
// 이번엔 소셜 로그인과의 "인증 절차 비일관성" 문제를 이메일 인증을 없애는
// 대신 이메일+비밀번호 계정에도 정식으로 인증 메일을 보내는 쪽으로 해결—
// 비밀번호 기반 계정은 이메일 소유 확인이 안 되면 비밀번호 찾기 등 후속
// 기능이 애초에 안전하지 않아서(사용자와 논의 후 확정).
export const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

const BCRYPT_SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateVerificationToken(): string {
  return randomUUID();
}
