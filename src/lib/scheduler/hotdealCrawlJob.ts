import { fetchRuliwebDeals, fetchRuliwebPostDetail, summarizeText } from "../hotdeal/ruliwebClient";
import { fetchProductPreview } from "../hotdeal/productPreview";
import { findHotdealPostBySourceId, createHotdealPost } from "../notion/hotdeal";
import { HOTDEAL_SOURCE } from "../notion/schema";
import { HOTDEAL_CRAWL_JOB_CONCURRENCY } from "../constants";
import { mapWithConcurrency } from "../utils/concurrency";

const TITLE_MAX_LENGTH = 120;
const MODEL_NAME_MAX_LENGTH = 80;
const PRODUCT_PREVIEW_MAX_LENGTH = 150;

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

      // 사용자 요청(2026-08)으로 원문 전체가 아니라 짧은 요약만 만들어 넣음
      // — 원문 전체 재게시는 저작권 리스크가 있어(§CLAUDE.md 21.6, 뽐뿌를
      // 제외했던 이유와 같은 종류) 사용자와 논의 후 요약 방식으로 확정.
      // 본문 스크래핑이 실패해도(비공식 페이지 구조 의존) 딜 자체는 그대로
      // 게시함 — 요약은 부가 정보일 뿐, 없어도 가격 비교표는 정상.
      const detail = await fetchRuliwebPostDetail(deal.link);
      const summary = detail?.bodyText ? summarizeText(detail.bodyText) : "";

      // 사용자 요청(2026-08 후속) — 본문의 구매 링크를 따라가 상품 정보를
      // 함께 기재. 구매 링크는 매번 다른 임의 쇼핑몰이라 사이트별로 성공률이
      // 제각각임(쿠팡·G마켓은 이미 차단 확인됨, §21.5) — 실패해도 조용히
      // 건너뛰고 요약만으로 게시(사용자와 합의한 "되는 곳만 best-effort").
      let productPreviewText = "";
      let previewImage: string | null = null;
      if (detail?.purchaseLink) {
        const preview = await fetchProductPreview(detail.purchaseLink);
        if (preview) {
          const combined = [preview.title, preview.description].filter(Boolean).join(" — ");
          if (combined) productPreviewText = `[구매처 미리보기]\n${summarizeText(combined, PRODUCT_PREVIEW_MAX_LENGTH)}`;
          previewImage = preview.image;
        }
      }

      const body = [summary, productPreviewText].filter(Boolean).join("\n\n");

      await createHotdealPost({
        title: deal.title.slice(0, TITLE_MAX_LENGTH),
        body,
        modelName: deal.title.slice(0, MODEL_NAME_MAX_LENGTH),
        authorNickname: deal.author || "루리웹",
        authorId: "",
        comparisons: [{ platform: "루리웹", price: deal.price, url: deal.link }],
        source: HOTDEAL_SOURCE.crawled,
        sourceId: deal.sourceId,
        thumbnailUrl: deal.thumbnailUrl || previewImage || "",
      });
      createdCount++;
    } catch (err) {
      console.error(`[hotdealCrawlJob] failed to process "${deal.title}":`, err);
    }
  });

  console.log(`[hotdealCrawlJob] done (${createdCount} new post(s), ${skippedNoPrice} skipped for missing price)`);
}
