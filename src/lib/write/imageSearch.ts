import { getErrorMessage } from "@/lib/utils/errors";

const MAX_QUERIES = 4;
const PER_QUERY_RESULTS = 3; // Pixabay's per_page minimum is 3
const FETCH_TIMEOUT_MS = 5000;

export interface StockImageResult {
  query: string;
  webformatURL: string; // Pixabay 약관상 임시 링크(24h) — 이번 응답에 한 번 보여주는 용도로만 사용, 저장/재서빙 안 함
  pageURL: string; // 원본 페이지 링크(출처 표시용)
}

// PIXABAY_API_KEY가 아직 없거나(2026-07 시점 미발급) 요청이 실패해도 절대
// throw하지 않음 — 스톡 이미지 추천은 부가 기능이라 이것 때문에 /api/write
// 전체가 실패하면 안 됨(section 10.3의 settle() 패턴과 같은 원칙).
export async function searchStockImages(queries: string[]): Promise<StockImageResult[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return [];

  const results = await Promise.all(queries.slice(0, MAX_QUERIES).map((q) => searchOne(apiKey, q)));
  return results.flat();
}

async function searchOne(apiKey: string, query: string): Promise<StockImageResult[]> {
  try {
    const url = new URL("https://pixabay.com/api/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", query);
    url.searchParams.set("image_type", "photo");
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("per_page", String(PER_QUERY_RESULTS));

    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return [];

    const data = (await res.json()) as { hits?: unknown[] };
    const hits = Array.isArray(data.hits) ? data.hits : [];
    return hits
      .map((h) => h as Record<string, unknown>)
      .map((h) => ({
        query,
        webformatURL: typeof h.webformatURL === "string" ? h.webformatURL : "",
        pageURL: typeof h.pageURL === "string" ? h.pageURL : "",
      }))
      .filter((r) => r.webformatURL);
  } catch (err) {
    console.error(`[searchStockImages] query "${query}" failed:`, getErrorMessage(err));
    return [];
  }
}
