import { NextResponse } from "next/server";
import { findUserByEmail, setSession } from "@/lib/notion/users";
import { verifyPassword, SESSION_COOKIE } from "@/lib/write/auth";
import { getErrorMessage } from "@/lib/utils/errors";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30일

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

  if (!email || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  try {
    const user = await findUserByEmail(email);
    // Same generic error whether the email doesn't exist or the password is
    // wrong — don't leak which emails are registered.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않아요." }, { status: 401 });
    }
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "이메일 인증을 먼저 완료해 주세요. 가입 시 받은 메일을 확인해 주세요." },
        { status: 403 }
      );
    }

    const sessionToken = await setSession(user.pageId);
    const response = NextResponse.json({ ok: true });
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
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했어요." }, { status: 502 });
  }
}
