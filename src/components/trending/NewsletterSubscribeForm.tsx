"use client";

import { useState } from "react";

export default function NewsletterSubscribeForm() {
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
        <h3 className="text-base font-semibold text-ink">구독 신청 완료!</h3>
        <p className="text-sm text-ink-muted">주간 급상승 키워드 요약을 이메일로 보내드릴게요.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col items-center gap-3 rounded-lg border border-hairline bg-surface p-6 text-center"
    >
      <h3 className="text-base font-semibold text-ink">주간 급상승 키워드 이메일로 받기</h3>
      <p className="text-sm text-ink-muted">
        매주 요즘 뜨는 검색어와 상승 키워드를 요약해 보내드려요. 언제든 수신 거부할 수 있어요.
      </p>
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
          {loading ? "신청 중..." : "구독하기"}
        </button>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
    </form>
  );
}
