import { NextResponse } from "next/server";
import { findUserByEmail, setSession } from "@/lib/notion/users";
import { isValidEmail, verifyPassword, SESSION_COOKIE } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// 이메일+비밀번호 로그인(§CLAUDE.md 22) — 소셜 계정(가입방식이 네이버/
// 카카오/구글)은 passwordHash가 비어있어 verifyPassword 자체가 항상
// false를 반환하므로, "이 이메일은 소셜 로그인으로 가입했어요" 같은 별도
// 분기 없이도 자연스럽게 막힘(비밀번호 불일치와 동일한 메시지로 통일 —
// 계정 존재 여부를 굳이 흘리지 않는 쪽이 더 안전).
export async function POST(request: Request) {
  let email: string;
  let password: string;
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!isValidEmail(email) || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않아요." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않아요." }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { error: "이메일 인증이 아직 완료되지 않았어요. 받은 메일함을 확인해 주세요.", needsVerification: true },
      { status: 403 }
    );
  }

  try {
    const sessionToken = await setSession(user.pageId);
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    console.error("[POST /api/auth/login] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "로그인에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
