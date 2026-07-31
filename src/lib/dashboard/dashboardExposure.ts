import { searchBlog, searchLocal } from "../naver/openApiClient";
import { findExposureRank, findLocalExposureRank } from "./exposure";
import { mapWithConcurrency } from "../utils/concurrency";
import { NAVER_OPENAPI_CONCURRENCY } from "../constants";

export interface DashboardExposureResult {
  keyword: string;
  ranks: Record<string, number | null>;
}

// Same rank-finding logic as the standalone /api/exposure tool, but the
// competitor list comes from the business's saved `competitors` rows
// (RLS-scoped, read by the caller) instead of ad-hoc request input.
export async function getDashboardExposure(
  keywords: string[],
  competitorDomains: string[]
): Promise<DashboardExposureResult[]> {
  if (competitorDomains.length === 0) return [];

  return mapWithConcurrency(keywords, NAVER_OPENAPI_CONCURRENCY, async (keyword) => {
    const { items } = await searchBlog(keyword);
    const ranks: Record<string, number | null> = {};
    for (const domain of competitorDomains) {
      ranks[domain] = findExposureRank(items, domain);
    }
    return { keyword, ranks };
  });
}

export interface LocalExposureEntry {
  businessName: string;
  label: string;
  isMine: boolean;
}

export interface DashboardLocalExposureResult {
  keyword: string;
  ranks: Record<string, number | null>; // businessName으로 키를 잡음
}

// 지역·플레이스 노출순위 — 네이버 공식 지역검색 API(local.json) 기반. 이
// API는 업체명으로만 매칭 가능해서(§ exposure.ts) 블로그 경쟁사 비교와 같은
// 방식(entries 배열)으로 "내 업체" + "비교 업체명"을 함께 비교한다(2026-07
// 확장 — 처음엔 "내 업체" 단일 값만 받았으나 경쟁사와 비교하고 싶다는 요청으로
// 입력 폼에 "비교 업체명" 필드를 추가함). 네이버 통합검색(블렌디드 SERP)
// 순위는 공식 API가 없어 스크래핑이 필요한데, 블로그 페이지 스크래핑보다
// 리스크가 커서 사용자와 논의 후 이번 범위에서 제외함(CLAUDE.md 섹션 10.3.2
// 참고) — 다시 검토하려면 먼저 사용자 승인부터 받을 것.
export async function getDashboardLocalExposure(
  keywords: string[],
  entries: LocalExposureEntry[]
): Promise<DashboardLocalExposureResult[]> {
  if (entries.length === 0) return [];

  return mapWithConcurrency(keywords, NAVER_OPENAPI_CONCURRENCY, async (keyword) => {
    const { items } = await searchLocal(keyword);
    const ranks: Record<string, number | null> = {};
    for (const entry of entries) {
      ranks[entry.businessName] = findLocalExposureRank(items, entry.businessName);
    }
    return { keyword, ranks };
  });
}
