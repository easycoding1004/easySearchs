import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { findUserBySessionToken, type User } from "@/lib/notion/users";

const SALT_ROUNDS = 10;
export const SESSION_COOKIE = "write_session";
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

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
