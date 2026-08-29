"use client";

import { useState } from "react";

// 2026-08 재설계(1단계) — /write의 "출시 알림 받기"에서도 재사용할 수 있게
// 카피를 props로 뺌(기본값은 기존 /trending 뉴스레터 카피 그대로). 저장소는
// 두 경우 다 동일한 뉴스레터 구독자 DB(/api/subscribe) — 별도 대기 명단
// DB를 만드는 대신, 발송되는 메일이 뉴스레터라는 사실을 카피에 정직하게
// 밝히는 쪽을 택함(수신 해지 링크도 기존 뉴스레터 인프라 그대로 적용됨).
type Props = {
  title?: string;
  description?: string;
  buttonLabel?: string;
  successTitle?: string;
  successDescription?: string;
};

export default function NewsletterSubscribeForm({
  title = "주간 급상승 키워드 이메일로 받기",
  description = "매주 요즘 뜨는 검색어와 상승 키워드를 요약해 보내드려요. 언제든 수신 거부할 수 있어요.",
  buttonLabel = "구독하기",
  successTitle = "구독 신청 완료!",
  successDescription = "주간 급상승 키워드 요약을 이메일로 보내드릴게요.",
}: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "구독 신청에 실패했습니다.");
        return;
      }

      setSubscribed(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (subscribed) {
    return (
      <div className="flex w-full flex-col items-center gap-1 rounded-lg border border-hairline bg-surface p-6 text-center">
        <h3 className="text-base font-semibold text-ink">{successTitle}</h3>
        <p className="text-sm text-ink-muted">{successDescription}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col items-center gap-3 rounded-lg border border-hairline bg-surface p-6 text-center"
    >
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-muted">{description}</p>
      <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일 주소"
          aria-label="이메일 주소"
          className="h-11 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="h-11 shrink-0 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
        >
          {loading ? "신청 중..." : buttonLabel}
        </button>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
