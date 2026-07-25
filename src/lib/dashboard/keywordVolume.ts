import { fetchKeywordStats } from "@/lib/naver/client";
import type { NormalizedKeywordRow } from "@/lib/naver/types";
import { MAX_SEED_KEYWORDS } from "@/lib/constants";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { NAVER_OPENAPI_CONCURRENCY } from "@/lib/constants";

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Naver's keywordstool API accepts at most MAX_SEED_KEYWORDS comma-separated
// hintKeywords per call, so a business tracking more keywords than that
// needs multiple batched calls. Naver also tends to pad each response with
// extra suggested keywords beyond what was asked for — filter those out
// since this panel only shows the business's own tracked keywords, not
// Naver's suggestions.
export async function getKeywordVolumes(
  keywords: string[]
): Promise<NormalizedKeywordRow[]> {
  const batches = chunk(keywords, MAX_SEED_KEYWORDS);
  const targets = new Set(keywords.map(normalizeForMatch));

  // hintKeywords 파라미터는 공백이 섞이면 400 에러를 낸다(실측 확인,
  // src/app/api/search/route.ts와 동일한 이슈) — 매칭은 normalizeForMatch가
  // 이미 공백을 무시하므로 여기서 제거해도 targets 매칭에는 영향 없음.
  const results = await mapWithConcurrency(
    batches,
    NAVER_OPENAPI_CONCURRENCY,
    (batch) => fetchKeywordStats(batch.map((k) => k.replace(/\s+/g, "")).join(","))
  );

  return results
    .flat()
    .filter((row) => targets.has(normalizeForMatch(row.relKeyword)));
}
