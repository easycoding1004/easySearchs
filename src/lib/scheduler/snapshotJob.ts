import { CATEGORIES } from "../naver/categoryTrends";
import { fetchKeywordStats } from "../naver/client";
import { fetchTrendingKeywordsKR } from "../googleTrends/client";
import { upsertSnapshot } from "../notion/keywordSnapshots";
import { SNAPSHOT_SOURCE } from "../notion/schema";
import { SNAPSHOT_JOB_CONCURRENCY } from "../constants";
import { mapWithConcurrency } from "../utils/concurrency";

// 사용자가 우연히 검색해주길 기다리지 않고, 카테고리 시드 키워드 + 현재 구글
// 트렌드 목록을 주기적으로 훑어 스냅샷을 쌓는다 — getRisingKeywords()가 항상
// 꾸준한 커버리지를 갖도록.
export async function runSnapshotJob(): Promise<void> {
  const categoryKeywords = CATEGORIES.map((c) => c.seedKeyword);

  let trendingKeywords: string[] = [];
  try {
    const trending = await fetchTrendingKeywordsKR();
    trendingKeywords = trending.map((t) => t.title.replace(/\s+/g, "")).filter(Boolean);
  } catch (err) {
    console.error("[snapshotJob] Google Trends fetch failed:", err);
  }

  const keywords = Array.from(new Set([...categoryKeywords, ...trendingKeywords]));

  console.log(`[snapshotJob] running for ${keywords.length} keyword(s)`);

  await mapWithConcurrency(keywords, SNAPSHOT_JOB_CONCURRENCY, async (keyword) => {
    try {
      const rows = await fetchKeywordStats(keyword);
      const match = rows.find((r) => r.relKeyword === keyword) ?? rows[0];
      if (!match) return;
      await upsertSnapshot(
        keyword,
        match.monthlyPcQcCnt,
        match.monthlyMobileQcCnt,
        SNAPSHOT_SOURCE.scheduledJob
      );
    } catch (err) {
      console.error(`[snapshotJob] failed for "${keyword}":`, err);
    }
  });

  console.log(`[snapshotJob] done (${keywords.length} keyword(s) processed)`);
}
