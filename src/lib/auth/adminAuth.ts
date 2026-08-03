import { cookies } from "next/headers";

const ADMIN_COOKIE = "admin_auth";

// /admin 로그인(ADMIN_PASSWORD, src/proxy.ts·api/admin/login과 동일한 쿠키)을
// 재사용해 "사이트 운영자" 여부를 판별함(§CLAUDE.md 18 게시판 관리자 권한).
// 별도 사용자 role 개념을 새로 안 만드는 이유: 닉네임 등 사용자가 직접
// 정하는 값으로 관리자를 식별하면 아무나 같은 값으로 자신을 위장할 수 있어
// 보안 구멍이 되므로, 이 사이트에 이미 있는 단일 소유자 전용 비밀번호
// 게이트를 그대로 쓰는 쪽이 안전함.
export async function isAdminAuthed(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === password;
}
