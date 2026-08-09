"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 즉시 무료 전환이 아니라 "다음 결제일에 청구하지 말고 무료로 전환하라"는
// 예약만 세움(이미 낸 이번 달 혜택은 유지) — /api/billing/cancel 참고.
export default function CancelSubscriptionButton({ cancelPending }: { cancelPending: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cancelPending) {
    return <p className="text-sm text-ink-muted">다음 결제일에 자동으로 무료 회원으로 전환돼요.</p>;
  }

  async function handleCancel() {
    if (!confirm("구독을 해지할까요? 이번 결제 주기가 끝날 때까지는 계속 이용할 수 있어요.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "해지에 실패했어요.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "해지에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink-muted transition ease-spring hover:bg-bg disabled:opacity-60"
      >
        {loading ? "처리 중..." : "구독 해지하기"}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
