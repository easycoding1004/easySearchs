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

  const results = await mapWithConcurrency(
    batches,
    NAVER_OPENAPI_CONCURRENCY,
    (batch) => fetchKeywordStats(batch.join(","))
  );

  return results
    .flat()
    .filter((row) => targets.has(normalizeForMatch(row.relKeyword)));
}
