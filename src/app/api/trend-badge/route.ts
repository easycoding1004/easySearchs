import { NextResponse } from "next/server";
import { fetchSearchTrend } from "@/lib/naver/datalabSearchClient";
import { computeTrendDirection, type TrendDirection } from "@/lib/naver/trendDirection";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { MAX_TREND_BADGE_KEYWORDS, NAVER_OPENAPI_CONCURRENCY } from "@/lib/constants";
import { getErrorMessage } from "@/lib/utils/errors";

const TREND_WINDOW_MONTHS = 3;

function threeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - TREND_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// 개인 도구(/result)와 블로그지수(/dashboard) 양쪽에서 쓰는 공통 라우트라
// 세션 타입(검색 세션 vs 블로그지수 세션)에 안 묶고 키워드 목록만 받음.
export async function POST(request: Request) {
  let keywords: string[];
  try {
    const body = await request.json();
    keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k: unknown): k is string => typeof k === "string").slice(0, MAX_TREND_BADGE_KEYWORDS)
      : [];
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (keywords.length === 0) {
    return NextResponse.json({ error: "keywords가 필요합니다." }, { status: 400 });
  }

  const startDate = threeMonthsAgo();
  const endDate = today();

  try {
    const entries = await mapWithConcurrency(
      keywords,
      NAVER_OPENAPI_CONCURRENCY,
      async (keyword): Promise<[string, TrendDirection | null]> => {
        try {
          const trend = await fetchSearchTrend(
            [{ groupName: keyword, keywords: [keyword] }],
            startDate,
            endDate,
            "month"
          );
          const direction = computeTrendDirection(trend.results[0]?.data ?? []);
          return [keyword, direction];
        } catch (err) {
          console.error(`[POST /api/trend-badge] failed for "${keyword}":`, err);
          return [keyword, null];
        }
      }
    );
    return NextResponse.json({ directions: Object.fromEntries(entries) });
  } catch (err) {
    const message = getErrorMessage(err);
    console.error("[POST /api/trend-badge] failed:", message, err);
    return NextResponse.json({ error: `트렌드 조회에 실패했습니다: ${message}` }, { status: 502 });
  }
}
