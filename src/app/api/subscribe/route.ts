import { NextResponse } from "next/server";
import { subscribeEmail } from "@/lib/notion/subscribers";
import { getErrorMessage } from "@/lib/utils/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let email: string;
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });
  }

  try {
    await subscribeEmail(email);
  } catch (err) {
    console.error("[POST /api/subscribe] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "구독 신청에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
