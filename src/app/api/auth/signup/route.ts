import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createUser, findUserByEmail } from "@/lib/notion/users";
import { hashPassword, isValidEmail, MIN_PASSWORD_LENGTH } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

const SITE_URL = "https://ezzsearch.com";

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

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.` },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[POST /api/auth/signup] Missing RESEND_API_KEY");
    return NextResponse.json({ error: "가입이 일시적으로 불가능합니다." }, { status: 502 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "이미 가입된 이메일이에요. 로그인해 주세요." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = await createUser(email, passwordHash);
  const verifyUrl = `${SITE_URL}/api/auth/verify?token=${verificationToken}`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM ?? "이지서치 <contact@ezzsearch.com>",
      to: email,
      subject: "[이지서치] 이메일 인증을 완료해 주세요",
      html: `<p>아래 링크를 클릭하면 가입이 완료돼요.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[POST /api/auth/signup] verification email failed:", getErrorMessage(err), err);
    return NextResponse.json(
      { error: "인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
