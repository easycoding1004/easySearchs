"use client";

import { useState } from "react";
import Link from "next/link";

// 2026-08 추가(제품 감사 — "장기 제안: 관심 키워드 구독 + 변화 알림") —
// 개인 도구는 원래 1회성 조회 도구라(§CLAUDE.md 1) 매번 새로 검색해야
// 했는데, 로그인 회원은 시드 키워드를 "관심 키워드"로 등록해두면
// keywordWatchJob.ts가 매일 검색량을 다시 확인해서 크게 바뀌면(±20%)
// 이메일로 알려줌 — 재방문을 유도하는 첫 개인 도구 기능(급상승 다이제스트
// §6.4와 달리 "내가 고른 키워드" 기준).
export default function KeywordWatchButton({
  loggedIn,
  seedKeywords,
}: {
  loggedIn: boolean;
  seedKeywords: { keyword: string; totalCount: number }[];
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  if (seedKeywords.length === 0) return null;

  if (!loggedIn) {
    return (
      <p className="rounded-lg border border-dashed border-hairline bg-surface px-4 py-3 text-xs text-ink-muted">
        <Link href={`/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`} className="font-semibold text-primary hover:underline">
          로그인
        </Link>
        하면 이 키워드들의 검색량이 크게 바뀔 때 이메일로 알려드려요.
      </p>
    );
  }

  if (status === "done") {
    return (
      <p className="rounded-lg border border-hairline bg-success-bg px-4 py-3 text-xs font-medium text-success">
        관심 키워드로 등록했어요. 검색량이 20% 이상 바뀌면 이메일로 알려드릴게요. (내 정보 &gt; 관심 키워드에서 확인·해지할 수 있어요)
      </p>
    );
  }

  async function handleClick() {
    setStatus("saving");
    try {
      const res = await fetch("/api/keyword-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: seedKeywords.map((k) => ({ keyword: k.keyword, baselineCount: k.totalCount })),
        }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "saving"}
        className="rounded-md border border-hairline px-4 py-2 text-sm font-medium text-ink transition ease-spring hover:bg-bg disabled:opacity-50"
      >
        {status === "saving" ? "등록 중..." : "🔔 이 키워드 변화 알림 받기"}
      </button>
      {status === "error" && <span className="text-xs text-error">등록에 실패했어요. 다시 시도해주세요.</span>}
    </div>
  );
}
