"use client";

import { useEffect, useRef, useState } from "react";
import type { CategoryDef } from "@/lib/naver/categoryTrends";
import type { NormalizedKeywordRow } from "@/lib/naver/types";

const ROTATE_INTERVAL_MS = 3000;

interface Slide {
  category: CategoryDef;
  rows: NormalizedKeywordRow[];
  fetchedAt: number | null;
  error: boolean;
}

interface CachedCategory {
  rows: NormalizedKeywordRow[];
  fetchedAt: number;
}

// Auto-rotating carousel through every category's BEST10 — starts from
// whatever category the page server-rendered (avoids a flash of empty
// content), then cycles through the rest client-side, fetching each one
// on demand via /api/category-trends (which shares the same server-side
// TTL cache as the initial SSR fetch) and caching it locally so a full
// loop never re-fetches the same category twice.
export default function CategoryTopKeywordsPanel({
  categories,
  initialCategory,
  initialRows,
  initialFetchedAt,
  initialError,
}: {
  categories: CategoryDef[];
  initialCategory: CategoryDef;
  initialRows: NormalizedKeywordRow[];
  initialFetchedAt: number | null;
  initialError: boolean;
}) {
  const [slide, setSlide] = useState<Slide>({
    category: initialCategory,
    rows: initialRows,
    fetchedAt: initialFetchedAt,
    error: initialError,
  });

  const indexRef = useRef(Math.max(0, categories.findIndex((c) => c.id === initialCategory.id)));
  const cacheRef = useRef(
    new Map<string, CachedCategory>(
      !initialError && initialFetchedAt != null
        ? [[initialCategory.id, { rows: initialRows, fetchedAt: initialFetchedAt }]]
        : []
    )
  );

  useEffect(() => {
    if (categories.length <= 1) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      indexRef.current = (indexRef.current + 1) % categories.length;
      const next = categories[indexRef.current];
      const cached = cacheRef.current.get(next.id);

      if (cached) {
        if (!cancelled) {
          setSlide({ category: next, rows: cached.rows, fetchedAt: cached.fetchedAt, error: false });
        }
        return;
      }

      try {
        const res = await fetch(`/api/category-trends?category=${next.id}`);
        if (!res.ok) throw new Error("request failed");
        const data = await res.json();
        cacheRef.current.set(next.id, { rows: data.rows, fetchedAt: data.fetchedAt });
        if (!cancelled) {
          setSlide({ category: next, rows: data.rows, fetchedAt: data.fetchedAt, error: false });
        }
      } catch {
        if (!cancelled) {
          setSlide({ category: next, rows: [], fetchedAt: null, error: true });
        }
      }
    }, ROTATE_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [categories]);

  return (
    <div
      id="category-trends"
      className="flex w-full flex-col gap-2 overflow-hidden rounded-lg border border-hairline bg-surface p-4"
    >
      <div key={slide.category.id} className="category-slide-in flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {slide.category.label} 관련 검색어 BEST 10
          </h3>
          <p className="text-xs text-ink-muted">
            네이버 공식 인기 검색어 순위가 아니라, &quot;{slide.category.seedKeyword}&quot;
            연관검색어 중 검색량이 높은 순이에요.
          </p>
        </div>

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
            {new Date(slide.fetchedAt).toLocaleString("ko-KR")} 기준
          </p>
        )}
      </div>
    </div>
  );
}
