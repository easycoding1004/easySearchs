"use client";

import { useEffect, useState } from "react";
import type { TrendDirection } from "@/lib/naver/trendDirection";

interface FetchResult {
  keyword: string;
  direction: TrendDirection | null;
}

const STYLES: Record<TrendDirection, { arrow: string; color: string }> = {
  상승: { arrow: "▲", color: "text-success" },
  보합: { arrow: "－", color: "text-ink-muted" },
  하락: { arrow: "▼", color: "text-error" },
};

// 개인 도구(/result)와 블로그지수(/dashboard) 양쪽 키워드 표에서 재사용 —
// 각자 자기 키워드만 조회하는 자체 완결형 배지라 두 표의 데이터 흐름을
// 건드리지 않고 붙일 수 있음. 최근 3개월 방향성만 보여줌(§ CLAUDE.md 참고).
export default function TrendDirectionBadge({ keyword }: { keyword: string }) {
  const [result, setResult] = useState<FetchResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trend-badge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: [keyword] }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { directions?: Record<string, TrendDirection | null> }) => {
        if (!cancelled) setResult({ keyword, direction: data.directions?.[keyword] ?? null });
      })
      .catch(() => {
        if (!cancelled) setResult({ keyword, direction: null });
      });
    return () => {
      cancelled = true;
    };
  }, [keyword]);

  const loading = result?.keyword !== keyword;
  if (loading) return null;

  const direction = result.direction;
  if (!direction) return null;

  const style = STYLES[direction];
  return (
    <span className={`text-xs font-semibold ${style.color}`}>
      {style.arrow} {direction}
    </span>
  );
}
