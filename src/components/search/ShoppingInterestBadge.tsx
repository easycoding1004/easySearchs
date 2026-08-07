"use client";

import { useEffect, useState } from "react";
import type { TrendDirection } from "@/lib/naver/trendDirection";

interface FetchResult {
  keyword: string;
  category: string | null;
  label: string | null;
  direction: TrendDirection | null;
}

const STYLES: Record<TrendDirection, { arrow: string; color: string }> = {
  상승: { arrow: "▲", color: "text-success" },
  보합: { arrow: "－", color: "text-ink-muted" },
  하락: { arrow: "▼", color: "text-error" },
};

// 개인 도구(/result) 시드 키워드 전용 — 네이버 쇼핑 개별 상품 검색 API가
// 공식적으로도 스크래핑으로도 더 이상 불가능해서(§CLAUDE.md 16), 대신 이미
// 확보된 쇼핑인사이트(카테고리 단위 관심도)를 4개 카테고리(패션/뷰티/
// 헬스운동/여행)에 한해 참고로 보여줌. 매칭 안 되는 키워드가 대부분이라
// 아무것도 안 뜨는 게 정상 동작임(카테고리를 모른다고 0/기본값을 지어내지
// 않음).
export default function ShoppingInterestBadge({ keyword }: { keyword: string }) {
  const [result, setResult] = useState<FetchResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shopping-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { category?: string | null; label?: string; direction?: TrendDirection | null }) => {
        if (!cancelled) {
          setResult({
            keyword,
            category: data.category ?? null,
            label: data.label ?? null,
            direction: data.direction ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ keyword, category: null, label: null, direction: null });
      });
    return () => {
      cancelled = true;
    };
  }, [keyword]);

  const loading = result?.keyword !== keyword;
  if (loading) return null;
  if (!result.category || !result.direction) return null;

  const style = STYLES[result.direction];
  return (
    <span
      className={`text-xs font-semibold ${style.color}`}
      title={`네이버 쇼핑인사이트 기준 "${result.label}" 카테고리 관심도 — 이 키워드 자체가 아니라 카테고리 단위 추정치예요.`}
    >
      [{result.label} {style.arrow}]
    </span>
  );
}
