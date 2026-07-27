import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createInquiry } from "@/lib/notion/inquiries";
import { getErrorMessage } from "@/lib/utils/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request: Request) {
  let name: string;
  let email: string;
  let message: string;
  try {
    const body = await request.json();
    name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
    email = typeof body.email === "string" ? body.email.trim() : "";
    message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "문의 내용을 입력해 주세요." }, { status: 400 });
  }

  const to = process.env.CONTACT_EMAIL_TO;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) {
    console.error("[POST /api/contact] Missing RESEND_API_KEY or CONTACT_EMAIL_TO");
    return NextResponse.json({ error: "문의 접수가 일시적으로 불가능합니다." }, { status: 502 });
  }

  const senderLabel = name ? `${name} (${email})` : email;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "이지서치 문의 <contact@ezzsearch.com>",
      to,
      replyTo: email,
      subject: `[이지서치 문의] ${senderLabel}`,
      text: message,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.error("[POST /api/contact] email send failed:", errorMessage, err);
    return NextResponse.json({ error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }

  try {
    await createInquiry({ name, email, message });
  } catch (err) {
    // Email already sent — don't fail the request over the Notion backup copy.
    console.error("[POST /api/contact] Notion save failed (email already sent):", getErrorMessage(err), err);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
