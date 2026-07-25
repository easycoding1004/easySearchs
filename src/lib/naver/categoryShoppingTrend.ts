import { postDatalab } from "./datalabClient";
import { computeTrendDirection, type TrendDirection } from "./trendDirection";
import { CATEGORY_CID_MAP } from "./datalabCategories";
import { createTtlCache } from "../utils/ttlCache";

const TREND_WINDOW_MONTHS = 3;
const CACHE_TTL_MS = 60 * 60 * 1000; // categoryTrends.ts와 동일한 1시간

interface ShoppingCategoryTrendResponse {
  results: { data: { period: string; ratio: number }[] }[];
}

const cache = createTtlCache<string, TrendDirection | null>(CACHE_TTL_MS);

function threeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - TREND_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// CID 매핑이 있는 4개 카테고리(패션/뷰티/헬스·운동/여행)만 실제 값을 반환.
// 나머지는 undefined — "쇼핑 데이터 없음"을 지어내지 않고 프론트가 그 섹션을
// 아예 안 그리게 하기 위한 구분(null과 다름: null은 "조회했지만 방향을 말할
// 수 없음", undefined는 "애초에 조회 대상이 아님").
export async function getCategoryShoppingDirection(
  categoryId: string
): Promise<TrendDirection | null | undefined> {
  const mapping = CATEGORY_CID_MAP[categoryId];
  if (!mapping) return undefined;

  const cached = cache.get(categoryId);
  if (cached !== undefined) return cached;

  const data = await postDatalab<ShoppingCategoryTrendResponse>("/categories", {
    startDate: threeMonthsAgo(),
    endDate: today(),
    timeUnit: "month",
    category: [{ name: mapping.label, param: [mapping.cid] }],
    device: "",
    gender: "",
    ages: [],
  });

  const direction = computeTrendDirection(data.results[0]?.data ?? []);
  cache.set(categoryId, direction);
  return direction;
}
