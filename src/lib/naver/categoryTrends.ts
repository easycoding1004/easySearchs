import { fetchKeywordStats } from "./client";
import { createTtlCache } from "../utils/ttlCache";
import type { NormalizedKeywordRow } from "./types";

// Naver has no official "top keywords by category" ranking API (the
// 데이터랩 website's own "인기검색어 TOP 500" is powered by an internal
// endpoint, not part of the public Open API — verified against the
// documented Shopping Insight endpoint list, which only offers trend/
// demographic breakdowns for keywords you already specify). This derives
// an honest approximation instead: for each category, look up a
// representative seed keyword's real related-keyword volumes (키워드도구
// API) and rank those — labeled as "카테고리 관련 검색어", not "인기 검색어
// 순위", since it isn't Naver's own popularity ranking.
export interface CategoryDef {
  id: string;
  label: string;
  seedKeyword: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "food", label: "외식·맛집", seedKeyword: "맛집" },
  { id: "cafe", label: "카페·디저트", seedKeyword: "카페" },
  { id: "fashion", label: "패션", seedKeyword: "패션" },
  { id: "beauty", label: "뷰티", seedKeyword: "화장품" },
  { id: "education", label: "교육", seedKeyword: "학원" },
  { id: "fitness", label: "헬스·운동", seedKeyword: "헬스장" },
  { id: "travel", label: "여행", seedKeyword: "여행" },
  { id: "pet", label: "반려동물", seedKeyword: "반려동물" },
];

const TOP_N = 10;
// "주기적으로 새로고침" — not a live ranking, so an in-memory TTL cache
// (refetched at most once per window, shared across every visitor) is
// enough; no DB needed for a single-process personal tool.
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  rows: NormalizedKeywordRow[];
  fetchedAt: number;
}

const cache = createTtlCache<string, CacheEntry>(CACHE_TTL_MS);

function totalVolume(row: NormalizedKeywordRow): number {
  return row.monthlyPcQcCnt + row.monthlyMobileQcCnt;
}

export interface CategoryTopKeywords {
  category: CategoryDef;
  rows: NormalizedKeywordRow[];
  fetchedAt: number;
}

export async function getCategoryTopKeywords(
  categoryId: string
): Promise<CategoryTopKeywords> {
  const category = CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0];

  const cached = cache.get(category.id);
  if (cached) {
    return { category, rows: cached.rows, fetchedAt: cached.fetchedAt };
  }

  const raw = await fetchKeywordStats(category.seedKeyword);
  const rows = [...raw].sort((a, b) => totalVolume(b) - totalVolume(a)).slice(0, TOP_N);
  const entry: CacheEntry = { rows, fetchedAt: Date.now() };
  cache.set(category.id, entry);
  return { category, rows, fetchedAt: entry.fetchedAt };
}
