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

// Shared by the /write page (read-only, Server Component) and the auth API
// routes (read via the same cookie store) — a single source of truth for
// "who's logged in" so the two never drift out of sync on cookie name/shape.
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserBySessionToken(token);
}
