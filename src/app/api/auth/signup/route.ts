import { NextResponse } from "next/server";
import { Resend } from "resend";
import { findUserByEmail, createUser } from "@/lib/notion/users";
import { isValidEmail, hashPassword, generateVerificationToken, MIN_PASSWORD_LENGTH } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

const SITE_URL = "https://ezzsearch.com";

// 이메일+비밀번호 회원가입 부활(§CLAUDE.md 22, 사용자 요청) — 약관 동의는
// 소셜 로그인의 OAuth 리다이렉트 이후 화면(/signup/agree)과 달리 이 폼
// 자체에 체크박스로 있음(리다이렉트 제약이 없어서 굳이 분리할 필요가 없음).
export async function POST(request: Request) {
  let email: string;
  let password: string;
  let agreedTerms: boolean;
  let agreedPrivacy: boolean;
  let redirectTo: string;
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
    agreedTerms = body.agreedTerms === true;
    agreedPrivacy = body.agreedPrivacy === true;
    redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : "";
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
  if (!agreedTerms || !agreedPrivacy) {
    return NextResponse.json(
      { error: "이용약관과 개인정보처리방침에 모두 동의해야 가입할 수 있어요." },
      { status: 400 }
    );
  }

  // 소셜 계정도 title(이메일)이 같으면 걸림 — 다른 방식으로 이미 가입된
  // 이메일이라는 뜻이라 그대로 막는 게 맞음(계정 병합은 스코프 밖).
  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "이미 가입된 이메일이에요." }, { status: 409 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[POST /api/auth/signup] Missing RESEND_API_KEY");
    return NextResponse.json({ error: "지금은 가입할 수 없어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }

  const passwordHash = await hashPassword(password);
  const token = generateVerificationToken();

  try {
    await createUser(email, passwordHash, token);
  } catch (err) {
    console.error("[POST /api/auth/signup] createUser failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "가입에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }

  const verifyUrl = new URL(`${SITE_URL}/api/auth/verify`);
  verifyUrl.searchParams.set("token", token);
  if (redirectTo) verifyUrl.searchParams.set("redirect", redirectTo);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "이지서치 <contact@ezzsearch.com>",
      to: email,
      subject: "이지서치 이메일 인증을 완료해 주세요",
      html: `<p>이지서치 가입을 완료하려면 아래 링크를 눌러 이메일 인증을 마쳐 주세요.</p><p><a href="${verifyUrl.toString()}">이메일 인증하기</a></p><p>본인이 요청하지 않았다면 이 메일을 무시하셔도 돼요.</p>`,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    // 계정은 이미 만들어졌으니 실패를 숨기지 않고 알려줌 — 재발송 기능은
    // 아직 없어서(스코프 밖) 문의하기로 안내.
    console.error("[POST /api/auth/signup] verification email failed:", getErrorMessage(err), err);
    return NextResponse.json(
      { error: "계정은 만들어졌지만 인증 메일 발송에 실패했어요. 문의하기로 알려주세요." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
