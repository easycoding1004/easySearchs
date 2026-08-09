import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isPaidSubscriber, setCancelPending } from "@/lib/notion/users";
import { getErrorMessage } from "@/lib/utils/errors";

// 구독 해지 — 즉시 무료 전환이 아니라 "다음 결제일에 청구하지 말고 무료로
// 전환하라"는 예약만 세움(이미 낸 이번 달 혜택은 계속 유지). 실제 전환은
// billingJob이 다음 결제일에 이 플래그를 보고 처리함(§CLAUDE.md 신규 섹션).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  if (!isPaidSubscriber(user)) {
    return NextResponse.json({ error: "구독 중이 아니에요." }, { status: 400 });
  }

  try {
    await setCancelPending(user.pageId, true);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/billing/cancel] failed:", getErrorMessage(err), err);
    return NextResponse.json(
      { error: "해지 처리에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }
}
