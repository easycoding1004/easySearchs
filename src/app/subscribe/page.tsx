import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import AuthForms from "@/components/AuthForms";
import SubscribeButton from "@/components/billing/SubscribeButton";
import CancelSubscriptionButton from "@/components/billing/CancelSubscriptionButton";
import { getCurrentUser } from "@/lib/auth/session";
import {
  isPaidSubscriber,
  FREE_WRITE_USE_LIMIT,
  MONTHLY_WRITE_USE_LIMIT,
  SUBSCRIPTION_MONTHLY_AMOUNT,
} from "@/lib/notion/users";

export const metadata: Metadata = {
  title: "구독",
  description: "AI 블로그 자동글쓰기를 더 많이 쓰고, 블로그지수 AI 인사이트까지 확인해보세요.",
};

export const dynamic = "force-dynamic";

// Toss 결제 흐름이 실패하면 /subscribe?error=... 로 돌아옴(§CLAUDE.md 신규
// 섹션 — start-registration/confirm/카드 등록 SDK 콜백 각각의 실패 사유).
const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "요청이 올바르지 않아요. 다시 시도해 주세요.",
  auth_failed: "카드 등록 인증에 실패했어요. 다시 시도해 주세요.",
  payment_failed: "첫 결제에 실패했어요. 카드 정보를 확인하고 다시 시도해 주세요.",
  card_failed: "카드 등록이 취소됐어요.",
};

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? "구독 신청에 실패했어요." : null;

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-8 px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">이지서치 구독</h1>
          <p className="max-w-md text-sm text-ink-muted">
            AI 블로그 자동글쓰기를 더 많이 쓰고, 블로그지수 AI 종합 인사이트까지 확인해보세요.
          </p>
        </div>

        <div className="w-full max-w-sm rounded-xl border border-hairline bg-surface p-6 sm:p-8">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-ink">
              {SUBSCRIPTION_MONTHLY_AMOUNT.toLocaleString()}원
            </span>
            <span className="text-sm text-ink-muted">/ 월</span>
          </div>
          <ul className="mt-5 flex flex-col gap-2 text-sm text-ink">
            <li>AI 블로그 자동글쓰기 월 {MONTHLY_WRITE_USE_LIMIT}회 (무료 회원은 누적 {FREE_WRITE_USE_LIMIT}회)</li>
            <li>블로그지수 AI 종합 인사이트 리포트</li>
            <li>언제든 해지 가능 (해지해도 결제 주기가 끝날 때까지 계속 이용)</li>
          </ul>

          <div className="mt-6 flex flex-col gap-3">
            {errorMessage && <p className="text-sm text-error">{errorMessage}</p>}
            {!user ? (
              <AuthForms />
            ) : isPaidSubscriber(user) ? (
              <>
                <p className="text-sm text-ink-muted">
                  이미 구독 중이에요{user.nextBillingDate ? ` (다음 결제일: ${user.nextBillingDate})` : ""}.
                </p>
                <CancelSubscriptionButton cancelPending={user.cancelPending} />
              </>
            ) : (
              <SubscribeButton email={user.email} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
