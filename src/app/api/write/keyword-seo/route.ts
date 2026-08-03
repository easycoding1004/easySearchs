import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/write/auth";
import { fetchKeywordStats } from "@/lib/naver/client";
import { createTtlCache } from "@/lib/utils/ttlCache";
import { getErrorMessage } from "@/lib/utils/errors";
import type { NormalizedKeywordRow } from "@/lib/naver/types";

// 2026-08 추가(사용자 요청 — "SEO 노출도 분석, 키워드 경쟁도를 게이지바로
// 절대값 기준으로") — 생성된 글의 태그가 실제로 얼마나 검색되고 얼마나
// 경쟁이 있는지, 자체 계산한 점수가 아니라 네이버 검색광고 API 실측
// 데이터(§CLAUDE.md 5.2·17.2와 동일한 소스)를 그대로 보여준다. 스타일·
// 레이아웃·사진 순서 변경은 검색량·경쟁도에 영향이 없으므로 BlogWriterForm.tsx
// 쪽에서 그 옵션이 바뀔 때는 이 라우트를 재호출하지 않고, 태그가 바뀔 수
// 있는 시점(최초 생성 직후, 수정 요청 성공 직후)에만 호출한다.
const MAX_KEYWORDS = 3;
// /api/extension/keyword-lookup과 같은 이유(§CLAUDE.md 17.2) — 이 API는
// 오픈API 공유 스로틀과 별개 상품이라 지금까지 전용 제한이 없었음. 조정
// 화면에서 반복 트리거될 수 있으니 짧은 TTL로 같은 키워드 재조회를 흡수.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = createTtlCache<string, { monthlyVolume: number; compIdx: string | null }>(CACHE_TTL_MS);

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let keywords: string[];
  try {
    const body = await request.json();
    keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((v: unknown): v is string => typeof v === "string" && v.trim().length > 0).slice(0, MAX_KEYWORDS)
      : [];
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (keywords.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results: { keyword: string; monthlyVolume: number | null; compIdx: string | null }[] = [];
  const uncached: string[] = [];

  for (const keyword of keywords) {
    const cached = cache.get(normalizeForMatch(keyword));
    if (cached) {
      results.push({ keyword, monthlyVolume: cached.monthlyVolume, compIdx: cached.compIdx });
    } else {
      uncached.push(keyword);
    }
  }

  if (uncached.length > 0) {
    try {
      // §CLAUDE.md 15 — hintKeywords에 공백이 섞이면 400 에러라 키워드마다
      // 공백을 제거한 뒤 쉼표로 합쳐 한 번에 조회한다(keywordExpansion.ts와
      // 같은 다중 키워드 호출 패턴).
      const rows = await fetchKeywordStats(uncached.map((k) => k.replace(/\s+/g, "")).join(","));
      for (const keyword of uncached) {
        const target = normalizeForMatch(keyword);
        const match: NormalizedKeywordRow | undefined = rows.find(
          (r) => normalizeForMatch(r.relKeyword) === target
        );
        if (match) {
          const monthlyVolume = match.monthlyPcQcCnt + match.monthlyMobileQcCnt;
          cache.set(target, { monthlyVolume, compIdx: match.compIdx });
          results.push({ keyword, monthlyVolume, compIdx: match.compIdx });
        } else {
          // 매칭 실패(네이버가 이 키워드에 대한 데이터가 없는 경우 등) —
          // 지어내지 않고 정직하게 "정보 없음"으로 반환.
          results.push({ keyword, monthlyVolume: null, compIdx: null });
        }
      }
    } catch (err) {
      console.error("[POST /api/write/keyword-seo] fetchKeywordStats failed:", getErrorMessage(err));
      for (const keyword of uncached) {
        results.push({ keyword, monthlyVolume: null, compIdx: null });
      }
    }
  }

  return NextResponse.json({ results });
}
