import { searchBlog } from "./openApiClient";
import { parseNaverPostDate } from "../utils/naverDate";
import { mapWithConcurrency } from "../utils/concurrency";
import { createTtlCache } from "../utils/ttlCache";
import { NAVER_OPENAPI_CONCURRENCY } from "../constants";

export interface BlogPublishStats {
  totalPosts: number; // total blog posts matching the keyword (Naver blog search `total`)
  monthlyPosts: number; // posts published in the last 30 days
  saturation: number; // monthlyPosts / totalPosts * 100, one decimal
  estimated: boolean; // true when monthlyPosts is extrapolated rather than an exact count
}

const MONTH_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 검색 속도의 실제 병목은 openApiClient.ts의 공유 스로틀(최소 1초 간격)이라
// 병렬화로는 못 줄임 — 대신 같은 키워드가 다시 조회될 때(카테고리 시드
// 키워드는 여러 사용자가 겹쳐서 검색함) 네이버를 다시 안 때리도록 캐싱.
// 발행량은 몇 시간 안에 크게 안 바뀌는 지표라 3시간 TTL이면 안전함.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const cache = createTtlCache<string, BlogPublishStats>(CACHE_TTL_MS);

// One extra blog search per keyword (sort=date instead of sort=sim), reusing
// its `total` as "총 블로그 발행량". If the 30-day cutoff falls within the
// most recent 100 posts (typical for the long-tail local keywords this app
// targets), monthlyPosts is an exact count. Otherwise (posting is frequent
// enough that all 100 sampled posts are within the last month) it's
// extrapolated from the sample's posting rate and flagged as estimated.
export async function getBlogPublishStats(keyword: string): Promise<BlogPublishStats> {
  const cached = cache.get(keyword);
  if (cached) return cached;

  const { items, total } = await searchBlog(keyword, { sort: "date" });

  if (total <= 0 || items.length === 0) {
    const result: BlogPublishStats = { totalPosts: total, monthlyPosts: 0, saturation: 0, estimated: false };
    cache.set(keyword, result);
    return result;
  }

  const now = Date.now();
  const withinMonth = items.filter((item) => {
    const date = parseNaverPostDate(item.postdate);
    if (!date) return false;
    return (now - date.getTime()) / MS_PER_DAY <= MONTH_DAYS;
  });

  let monthlyPosts: number;
  let estimated: boolean;

  if (withinMonth.length < items.length) {
    monthlyPosts = withinMonth.length;
    estimated = false;
  } else {
    const oldest = items[items.length - 1];
    const oldestDate = parseNaverPostDate(oldest.postdate);
    const spanDays = oldestDate ? Math.max(1, (now - oldestDate.getTime()) / MS_PER_DAY) : MONTH_DAYS;
    monthlyPosts = Math.round((items.length / spanDays) * MONTH_DAYS);
    estimated = true;
  }

  monthlyPosts = Math.min(monthlyPosts, total);
  const saturation = Math.round((monthlyPosts / total) * 1000) / 10;

  const result: BlogPublishStats = { totalPosts: total, monthlyPosts, saturation, estimated };
  cache.set(keyword, result);
  return result;
}

// Batch wrapper keyed by keyword — sequential under the shared Naver Open
// API throttle, same as every other multi-keyword panel in this app.
export async function getBlogPublishStatsForKeywords(
  keywords: string[]
): Promise<Record<string, BlogPublishStats>> {
  const stats = await mapWithConcurrency(keywords, NAVER_OPENAPI_CONCURRENCY, async (keyword) => ({
    keyword,
    stats: await getBlogPublishStats(keyword),
  }));
  return Object.fromEntries(stats.map(({ keyword, stats: s }) => [keyword, s]));
}
