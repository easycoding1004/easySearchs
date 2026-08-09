import {
  getUsersWithBillingDue,
  downgradeToFree,
  renewSubscription,
  SUBSCRIPTION_MONTHLY_AMOUNT,
} from "../notion/users";
import { chargeBilling, generateOrderId, nextBillingDateFrom } from "../billing/tossClient";
import { createBillingRecord } from "../notion/billingHistory";
import { mapWithConcurrency } from "../utils/concurrency";
import { BILLING_JOB_CONCURRENCY } from "../constants";
import { getErrorMessage } from "../utils/errors";

// 토스는 정기 청구를 대신 스케줄링해주지 않음 — 가맹점이 직접 주기적으로
// 청구 API를 호출해야 한다(공식 문서로 확인). instrumentation.ts가
// snapshotJob/newsletterJob과 같은 setInterval 패턴으로 매일 이 잡을 돌려서
// "다음결제일<=오늘"인 유료회원을 훑는다. newsletterJob과 같은 이유로 서버
// 시작 시 즉시 실행하지 않음(매 배포마다 카드가 청구되면 안 되므로).
export async function runBillingJob(): Promise<void> {
  const dueUsers = await getUsersWithBillingDue();
  if (dueUsers.length === 0) {
    console.log("[billingJob] no subscriptions due today");
    return;
  }

  console.log(`[billingJob] processing ${dueUsers.length} due subscription(s)`);

  await mapWithConcurrency(dueUsers, BILLING_JOB_CONCURRENCY, async (user) => {
    // 해지 예약된 계정은 청구하지 않고 무료로 전환.
    if (user.cancelPending) {
      await downgradeToFree(user.pageId);
      console.log(`[billingJob] ${user.email}: cancel_pending -> downgraded to free`);
      return;
    }

    if (!user.tossBillingKey) {
      // 유료 상태인데 빌링키가 없는 건 데이터 이상 케이스 — 청구할 방법이
      // 없으니 안전하게 무료로 강등하고 로그를 남김.
      await downgradeToFree(user.pageId);
      console.error(`[billingJob] ${user.email}: missing billingKey, downgraded to free`);
      return;
    }

    const orderId = generateOrderId();
    const charge = await chargeBilling({
      billingKey: user.tossBillingKey,
      customerKey: user.tossCustomerKey,
      amount: SUBSCRIPTION_MONTHLY_AMOUNT,
      orderId,
      orderName: "이지서치 월 구독",
      customerEmail: user.email || undefined,
    });

    await createBillingRecord({
      authorId: user.pageId,
      email: user.email,
      amount: SUBSCRIPTION_MONTHLY_AMOUNT,
      success: charge.success,
      orderId,
      failureReason: charge.success ? null : charge.message,
    }).catch((err) =>
      console.error(`[billingJob] billing record write failed for ${user.email}:`, getErrorMessage(err))
    );

    if (charge.success) {
      // 원래 예정됐던 다음결제일을 기준으로 한 달 더 미룸 — 잡 실행이 며칠
      // 늦어지더라도(서버 재시작 타이밍 등) 결제 주기 자체가 밀리지 않도록
      // "오늘" 대신 이 사용자의 원래 nextBillingDate를 기준으로 계산함.
      await renewSubscription(user.pageId, nextBillingDateFrom(user.nextBillingDate));
      console.log(`[billingJob] ${user.email}: charged successfully`);
    } else {
      // MVP는 유예 기간 없이 즉시 강등(재시도/유예 로직은 스코프 밖).
      await downgradeToFree(user.pageId);
      console.error(`[billingJob] ${user.email}: charge failed (${charge.message}), downgraded to free`);
    }
  });

  console.log("[billingJob] done");
}
