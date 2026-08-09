import { NextResponse } from "next/server";
import {
  findUserByTossCustomerKey,
  activateSubscription,
  SUBSCRIPTION_MONTHLY_AMOUNT,
} from "@/lib/notion/users";
import { issueBillingKey, chargeBilling, generateOrderId, nextBillingDateFrom } from "@/lib/billing/tossClient";
import { createBillingRecord } from "@/lib/notion/billingHistory";
import { getKstDateString } from "@/lib/utils/formatDate";
import { getErrorMessage } from "@/lib/utils/errors";

// Toss SDK의 requestBillingAuth가 카드 등록 인증에 성공하면 브라우저를 이
// 라우트로 직접 리다이렉트시킴(successUrl) — authKey+customerKey가 쿼리로
// 옴. 여기서 실제 빌링키 발급 + 첫 달 결제까지 한 번에 처리하고, 성공하면
// 구독을 활성화한 뒤 결과 화면으로 다시 리다이렉트한다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const authKey = url.searchParams.get("authKey");
  const customerKey = url.searchParams.get("customerKey");

  function fail(reason: string) {
    return NextResponse.redirect(new URL(`/subscribe?error=${reason}`, url.origin));
  }

  if (!authKey || !customerKey) return fail("invalid_request");

  const user = await findUserByTossCustomerKey(customerKey);
  if (!user) return fail("invalid_request");

  let billingKey: string;
  try {
    const issued = await issueBillingKey(authKey, customerKey);
    billingKey = issued.billingKey;
  } catch (err) {
    console.error("[GET /api/billing/confirm] issueBillingKey failed:", getErrorMessage(err), err);
    return fail("auth_failed");
  }

  const orderId = generateOrderId();
  const charge = await chargeBilling({
    billingKey,
    customerKey,
    amount: SUBSCRIPTION_MONTHLY_AMOUNT,
    orderId,
    orderName: "이지서치 월 구독",
    customerEmail: user.email || undefined,
  });

  // 감사 로그 실패는 구독 활성화 자체를 막으면 안 됨 — createBillingRecord.ts
  // 주석 참고.
  await createBillingRecord({
    authorId: user.pageId,
    email: user.email,
    amount: SUBSCRIPTION_MONTHLY_AMOUNT,
    success: charge.success,
    orderId,
    failureReason: charge.success ? null : charge.message,
  }).catch((err) => console.error("[GET /api/billing/confirm] billing record write failed:", getErrorMessage(err)));

  if (!charge.success) return fail("payment_failed");

  await activateSubscription(user.pageId, {
    billingKey,
    nextBillingDate: nextBillingDateFrom(getKstDateString()),
  });

  return NextResponse.redirect(new URL("/write?subscribed=1", url.origin));
}
