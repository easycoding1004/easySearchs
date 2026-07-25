import { NextResponse } from "next/server";
import { recordVisit } from "@/lib/notion/visits";
import { getErrorMessage } from "@/lib/utils/errors";

// proxy.ts가 방문자 쿠키가 없는 요청에 한해 await 없이 호출함 — 실패해도
// 페이지 응답 자체는 이미 나간 뒤라 사용자에게 영향 없음, 로그만 남김.
export async function POST(request: Request) {
  let visitorId: string;
  let referrer: string;
  let landingPage: string;
  try {
    const body = await request.json();
    visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
    referrer = typeof body.referrer === "string" ? body.referrer : "직접 방문";
    landingPage = typeof body.landingPage === "string" ? body.landingPage : "홈";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!visitorId) {
    return NextResponse.json({ error: "visitorId가 필요합니다." }, { status: 400 });
  }

  try {
    await recordVisit(visitorId, referrer, landingPage);
  } catch (err) {
    console.error("[POST /api/visit] recordVisit failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "방문 기록에 실패했습니다." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
