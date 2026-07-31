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

export interface DashboardLocalExposureResult {
  keyword: string;
  rank: number | null;
}

// 지역·플레이스 노출순위 — 네이버 공식 지역검색 API(local.json) 기반. 이
// API는 업체명으로만 매칭 가능해서(§ exposure.ts) 블로그 경쟁사 비교와 달리
// "내 업체" 단일 값만 조회한다(비교 블로그 목록에 대응하는 "비교 업체명"
// 필드는 없음 — 필요해지면 입력 폼부터 다시 확장할 것). 네이버 통합검색
// (블렌디드 SERP) 순위는 공식 API가 없어 스크래핑이 필요한데, 블로그 페이지
// 스크래핑보다 리스크가 커서 사용자와 논의 후 이번 범위에서 제외함(CLAUDE.md
// 섹션 10.3.2 참고) — 다시 검토하려면 먼저 사용자 승인부터 받을 것.
export async function getDashboardLocalExposure(
  keywords: string[],
  businessName: string | null
): Promise<DashboardLocalExposureResult[]> {
  if (!businessName) return [];

  return mapWithConcurrency(keywords, NAVER_OPENAPI_CONCURRENCY, async (keyword) => {
    const { items } = await searchLocal(keyword);
    return { keyword, rank: findLocalExposureRank(items, businessName) };
  });
}
