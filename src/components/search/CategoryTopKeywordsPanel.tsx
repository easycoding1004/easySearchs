"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryDef } from "@/lib/naver/categoryTrends";
import type { NormalizedKeywordRow } from "@/lib/naver/types";
import type { TrendDirection } from "@/lib/naver/trendDirection";
import { formatKstDateTime } from "@/lib/utils/formatDate";

const ROTATE_INTERVAL_MS = 6000;

const DIRECTION_STYLE: Record<TrendDirection, { arrow: string; color: string }> = {
  상승: { arrow: "▲", color: "text-success" },
  보합: { arrow: "－", color: "text-ink-muted" },
  하락: { arrow: "▼", color: "text-error" },
};

interface Slide {
  category: CategoryDef;
  rows: NormalizedKeywordRow[];
  fetchedAt: number | null;
  error: boolean;
  // undefined = 이 카테고리는 쇼핑인사이트 CID 매핑 자체가 없음(조용히 숨김).
  shoppingDirection?: TrendDirection | null;
}

interface CachedCategory {
  rows: NormalizedKeywordRow[];
  fetchedAt: number;
  shoppingDirection?: TrendDirection | null;
}

// Auto-rotating carousel through every category's BEST10, with a select +
// dot indicators + arrows all driving the same client-side state (rather
// than the select triggering a full page nav while the carousel rotates
// independently, which used to visibly disagree with each other). Starts
// from whatever category the page server-rendered (avoids a flash of empty
// content), fetches the rest on demand via /api/category-trends (shares
// the server-side TTL cache) and caches them locally so a full loop never
// re-fetches the same category twice. Manual navigation resets the
// auto-rotate timer so it doesn't immediately jump again right after.
export default function CategoryTopKeywordsPanel({
  categories,
  initialCategory,
  initialRows,
  initialFetchedAt,
  initialError,
  initialShoppingDirection,
}: {
  categories: CategoryDef[];
  initialCategory: CategoryDef;
  initialRows: NormalizedKeywordRow[];
  initialFetchedAt: number | null;
  initialError: boolean;
  initialShoppingDirection?: TrendDirection | null;
}) {
  const [slide, setSlide] = useState<Slide>({
    category: initialCategory,
    rows: initialRows,
    fetchedAt: initialFetchedAt,
    error: initialError,
    shoppingDirection: initialShoppingDirection,
  });

  const indexRef = useRef(Math.max(0, categories.findIndex((c) => c.id === initialCategory.id)));
  const cacheRef = useRef(
    new Map<string, CachedCategory>(
      !initialError && initialFetchedAt != null
        ? [
            [
              initialCategory.id,
              { rows: initialRows, fetchedAt: initialFetchedAt, shoppingDirection: initialShoppingDirection },
            ],
          ]
        : []
    )
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    async (index: number) => {
      indexRef.current = index;
      const next = categories[index];
      const cached = cacheRef.current.get(next.id);

      if (cached) {
        setSlide({
          category: next,
          rows: cached.rows,
          fetchedAt: cached.fetchedAt,
          error: false,
          shoppingDirection: cached.shoppingDirection,
        });
        return;
      }

      try {
        const res = await fetch(`/api/category-trends?category=${next.id}`);
        if (!res.ok) throw new Error("request failed");
        const data = await res.json();
        cacheRef.current.set(next.id, {
          rows: data.rows,
          fetchedAt: data.fetchedAt,
          shoppingDirection: data.shoppingDirection,
        });
        setSlide({
          category: next,
          rows: data.rows,
          fetchedAt: data.fetchedAt,
          error: false,
          shoppingDirection: data.shoppingDirection,
        });
      } catch {
        setSlide({ category: next, rows: [], fetchedAt: null, error: true });
      }
    },
    [categories]
  );

  const restartTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (categories.length <= 1) return;
    intervalRef.current = setInterval(() => {
      goTo((indexRef.current + 1) % categories.length);
    }, ROTATE_INTERVAL_MS);
  }, [categories, goTo]);

  useEffect(() => {
    restartTimer();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [restartTimer]);

  function handleManualNavigate(index: number) {
    goTo(index);
    restartTimer();
  }

  return (
    <div
      id="category-trends"
      className="relative flex w-full flex-col gap-3 overflow-hidden rounded-lg border border-hairline bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">카테고리 검색어 BEST 10</h3>
        <select
          value={slide.category.id}
          onChange={(e) => {
            const idx = categories.findIndex((c) => c.id === e.target.value);
            if (idx >= 0) handleManualNavigate(idx);
          }}
          className="h-9 shrink-0 rounded-sm border border-hairline bg-surface px-2 text-xs text-ink transition-colors focus:border-primary focus:outline-none"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div key={slide.category.id} className="category-slide-in flex flex-col gap-2">
        <p className="text-xs text-ink-muted">
          네이버 공식 인기 검색어 순위가 아니라, &quot;{slide.category.seedKeyword}&quot;
          연관검색어 중 검색량이 높은 순이에요.
        </p>

        {slide.error ? (
          <p className="text-sm text-error">불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        ) : slide.rows.length === 0 ? (
          <p className="text-sm text-ink-muted">데이터가 없습니다.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {slide.rows.map((row, i) => (
              <li key={row.relKeyword} className="flex items-center gap-2 text-sm">
                <span className="w-5 shrink-0 text-right font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-ink">{row.relKeyword}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {(row.monthlyPcQcCnt + row.monthlyMobileQcCnt).toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}

        {slide.fetchedAt && (
          <p className="text-xs text-ink-muted">
            {formatKstDateTime(slide.fetchedAt)} 기준
          </p>
        )}

        {slide.shoppingDirection && (
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span>쇼핑 관심도(최근 3개월)</span>
            <span className={`font-semibold ${DIRECTION_STYLE[slide.shoppingDirection].color}`}>
              {DIRECTION_STYLE[slide.shoppingDirection].arrow} {slide.shoppingDirection}
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => handleManualNavigate((indexRef.current - 1 + categories.length) % categories.length)}
          aria-label="이전 카테고리"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-muted transition-colors hover:border-primary hover:text-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="flex gap-1.5">
          {categories.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleManualNavigate(i)}
              aria-label={c.label}
              className={`h-1.5 rounded-full transition-all ease-spring ${
                slide.category.id === c.id ? "w-4 bg-primary" : "w-1.5 bg-hairline"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => handleManualNavigate((indexRef.current + 1) % categories.length)}
          aria-label="다음 카테고리"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-muted transition-colors hover:border-primary hover:text-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
