import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { setTossCustomerKey } from "@/lib/notion/users";
import { generateCustomerKey } from "@/lib/billing/tossClient";
import { getErrorMessage } from "@/lib/utils/errors";

// 구독 시작 1단계 — 프론트가 Toss SDK의 requestBillingAuth를 부르기 전에
// 서버가 먼저 customerKey를 발급해 계정에 저장해둠(§CLAUDE.md 신규 섹션).
// 카드 등록 인증이 끝나면 브라우저가 /api/billing/confirm으로 리다이렉트되는데,
// 그 라우트는 세션 쿠키가 아니라 쿼리로 받은 customerKey로 역으로 사용자를
// 찾아야 하므로 미리 저장해두는 절차가 필요함.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const customerKey = generateCustomerKey();
    await setTossCustomerKey(user.pageId, customerKey);
    return NextResponse.json({ customerKey });
  } catch (err) {
    console.error("[POST /api/billing/start-registration] failed:", getErrorMessage(err), err);
    return NextResponse.json(
      { error: "구독 준비에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }
}
