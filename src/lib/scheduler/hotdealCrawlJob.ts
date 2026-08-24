import { fetchRuliwebDeals } from "../hotdeal/ruliwebClient";
import { findHotdealPostBySourceId, createHotdealPost } from "../notion/hotdeal";
import { HOTDEAL_SOURCE } from "../notion/schema";
import { HOTDEAL_CRAWL_JOB_CONCURRENCY } from "../constants";
import { mapWithConcurrency } from "../utils/concurrency";

const TITLE_MAX_LENGTH = 120;
const MODEL_NAME_MAX_LENGTH = 80;

// 루리웹 핫딜/예판 게시판 RSS를 1시간마다 훑어 아직 게시하지 않은 딜만
// 자동 등록 — policyBoardJob.ts와 동일한 dedup 패턴(원본 게시글 URL 기준).
// 제목에서 가격을 못 뽑아낸 글은 "핫딜"로서 의미가 없어 건너뜀(가격 비교
// 게시판의 핵심은 가격이라, 어설프게 가격 없이 올리느니 정직하게 스킵).
export async function runHotdealCrawlJob(): Promise<void> {
  let deals: Awaited<ReturnType<typeof fetchRuliwebDeals>> = [];
  try {
    deals = await fetchRuliwebDeals();
  } catch (err) {
    console.error("[hotdealCrawlJob] ruliweb fetch failed:", err);
    return;
  }

  console.log(`[hotdealCrawlJob] checking ${deals.length} deal(s)`);

  let createdCount = 0;
  let skippedNoPrice = 0;
  await mapWithConcurrency(deals, HOTDEAL_CRAWL_JOB_CONCURRENCY, async (deal) => {
    if (deal.price == null) {
      skippedNoPrice++;
      return;
    }
    try {
      const alreadyPosted = await findHotdealPostBySourceId(deal.sourceId);
      if (alreadyPosted) return;

      await createHotdealPost({
        title: deal.title.slice(0, TITLE_MAX_LENGTH),
        body: "",
        modelName: deal.title.slice(0, MODEL_NAME_MAX_LENGTH),
        authorNickname: deal.author || "루리웹",
        authorId: "",
        comparisons: [{ platform: "루리웹", price: deal.price, url: deal.link }],
        source: HOTDEAL_SOURCE.crawled,
        sourceId: deal.sourceId,
      });
      createdCount++;
    } catch (err) {
      console.error(`[hotdealCrawlJob] failed to process "${deal.title}":`, err);
    }
  });

  console.log(`[hotdealCrawlJob] done (${createdCount} new post(s), ${skippedNoPrice} skipped for missing price)`);
}
