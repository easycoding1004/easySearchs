import { searchBlog } from "./naver/openApiClient";
import { findExposureRank } from "./exposure";
import { mapWithConcurrency } from "./utils/concurrency";
import { NAVER_OPENAPI_CONCURRENCY } from "./constants";

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
