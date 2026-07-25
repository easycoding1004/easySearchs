"use client";

import { useSyncExternalStore } from "react";
import {
  getRecentKeywordsServerSnapshot,
  getRecentKeywordsSnapshot,
} from "@/lib/utils/recentKeywords";

// 구독할 대상이 없는(값이 바뀌었다는 알림을 안 주는) 스토어라 subscribe는
// 아무것도 안 함 — 그래도 useSyncExternalStore를 쓰는 이유는 서버 스냅샷([])과
// 클라이언트 스냅샷(localStorage)을 명시적으로 분리해 하이드레이션 불일치
// 경고 없이 마운트 후 실제 값으로 자연스럽게 전환하기 위함.
function subscribe() {
  return () => {};
}

export default function RecentKeywordsChips({
  onSelect,
}: {
  onSelect: (keyword: string) => void;
}) {
  const keywords = useSyncExternalStore(
    subscribe,
    getRecentKeywordsSnapshot,
    getRecentKeywordsServerSnapshot
  );

  if (keywords.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-ink-muted">최근 검색</span>
      {keywords.map((kw) => (
        <button
          key={kw}
          type="button"
          onClick={() => onSelect(kw)}
          className="rounded-full border border-hairline px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-primary hover:text-primary"
        >
          {kw}
        </button>
      ))}
    </div>
  );
}
