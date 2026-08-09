"use client";

import { useState } from "react";
import Script from "next/script";

// Toss Payments v2 SDK(https://js.tosspayments.com/v2/standard)가 전역에
// 붙이는 팩토리 — 공식 SDK 타입 패키지를 쓰지 않고(이 프로젝트의 다른 외부
// API 클라이언트들처럼 raw 호출) 실제 쓰는 만큼만 최소 타입을 선언함.
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      payment: (params: { customerKey: string }) => {
        requestBillingAuth: (params: {
          method: "CARD";
          successUrl: string;
          failUrl: string;
          customerEmail?: string;
        }) => Promise<void>;
      };
    };
  }
}

// 구독 시작 버튼 — 클릭 시 (1) 서버에 customerKey 발급 요청 →
// (2) Toss SDK로 카드 등록 인증 화면 진입. 인증에 성공하면 브라우저가
// /api/billing/confirm으로 리다이렉트되어 실제 빌링키 발급·첫 달 결제가
// 이어짐(§CLAUDE.md 신규 섹션). 아직 사용자가 토스 가맹점 가입 전이라
// 테스트 키로만 개발됨 — NEXT_PUBLIC_TOSS_CLIENT_KEY 미설정 시 안내만 함.
export default function SubscribeButton({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  async function handleSubscribe() {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      setError("결제 기능이 아직 설정되지 않았어요.");
      return;
    }
    if (!sdkReady || !window.TossPayments) {
      setError("결제 모듈을 불러오는 중이에요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/start-registration", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "구독 준비에 실패했어요.");

      const tossPayments = window.TossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: data.customerKey as string });
      const origin = window.location.origin;
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${origin}/api/billing/confirm`,
        failUrl: `${origin}/subscribe?error=card_failed`,
        customerEmail: email || undefined,
      });
      // 성공하면 브라우저가 successUrl로 리다이렉트되므로 이 아래로는 안 옴.
    } catch (err) {
      setError(err instanceof Error ? err.message : "구독 신청에 실패했어요.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Script
        src="https://js.tosspayments.com/v2/standard"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-60"
      >
        {loading ? "처리 중..." : "구독 시작하기"}
      </button>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
