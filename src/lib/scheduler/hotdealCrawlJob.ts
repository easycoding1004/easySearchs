import { fetchRuliwebDeals, fetchRuliwebPostDetail, summarizeText, type RuliwebDeal } from "../hotdeal/ruliwebClient";
import { fetchProductPreview, deriveShopLabel } from "../hotdeal/productPreview";
import { findHotdealPostBySourceId, createHotdealPost, type PriceEntry } from "../notion/hotdeal";
import { HOTDEAL_SOURCE } from "../notion/schema";
import { HOTDEAL_CRAWL_JOB_CONCURRENCY } from "../constants";
import { mapWithConcurrency } from "../utils/concurrency";

const TITLE_MAX_LENGTH = 120;
const MODEL_NAME_MAX_LENGTH = 80;
const PRODUCT_PREVIEW_MAX_LENGTH = 150;

// 2026-08 추가(사용자 요청 — "게시자의 닉네임은 루리웹 닉네임 말고 우리
// 사이트에 가입자의 닉네임으로") — 실제 회원 계정을 임의로 골라 그 사람
// 이름으로 자동수집 글을 게시하면 본인 동의 없는 프라이버시 문제가 되므로
// (§CLAUDE.md 18.7.1의 게시판 데모 시드와 달리 실제 계정이 걸림), 사용자와
// 논의 후 전용 표시계정을 하나 새로 만들어 그 닉네임을 고정으로 씀
// (scripts/create-hotdeal-display-account.ts로 생성, 로그인 불가 계정).
const DISPLAY_ACCOUNT_NICKNAME = "dealscout";
const DISPLAY_ACCOUNT_ID = "3c65ac20-1cc9-8184-ac78-eb1aba26528f";

export interface CrawledDealContent {
  body: string;
  comparisons: PriceEntry[];
  thumbnailUrl: string;
  authorNickname: string;
  authorId: string;
}

// 딜 하나(가격이 확정된 것)를 게시/업데이트에 필요한 필드로 가공 —
// runHotdealCrawlJob(신규 게시)과 scripts/backfill-hotdeal-crawled-details.ts
// (이미 올라온 글 백필) 둘 다 이 함수 하나를 공유해서, 요약·구매링크 상품
// 정보 로직이 두 곳에서 따로 관리되지 않게 함.
export async function buildCrawledDealContent(deal: RuliwebDeal & { price: number }): Promise<CrawledDealContent> {
  // 사용자 요청(2026-08)으로 원문 전체가 아니라 짧은 요약만 만들어 넣음 —
  // 원문 전체 재게시는 저작권 리스크가 있어(§CLAUDE.md 21.6, 뽐뿌를 제외했던
  // 이유와 같은 종류) 사용자와 논의 후 요약 방식으로 확정. 본문 스크래핑이
  // 실패해도(비공식 페이지 구조 의존) 딜 자체는 그대로 게시함 — 요약은 부가
  // 정보일 뿐, 없어도 가격 비교표는 정상.
  const detail = await fetchRuliwebPostDetail(deal.link);
  const summary = detail?.bodyText ? summarizeText(detail.bodyText) : "";

  // 사용자 요청(2026-08 후속) — 본문의 구매 링크를 따라가 상품 정보를 함께
  // 기재. 구매 링크는 매번 다른 임의 쇼핑몰이라 사이트별로 성공률이 제각각임
  // (쿠팡·G마켓은 이미 차단 확인됨, §21.5) — 실패해도 조용히 건너뛰고
  // 요약만으로 게시(사용자와 합의한 "되는 곳만 best-effort").
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

  // 사용자 요청(2026-08 후속) — "가격비교의 루리웹 링크를 없애줘": 가격
  // 비교표가 루리웹 게시글로 연결되는 게 아니라, 실제 구매 링크(있으면)로
  // 연결되도록 바꿈. 구매 링크를 못 찾은 경우에만 부득이 루리웹 링크로
  // 폴백(가격 비교표 자체가 빈 채로 나오는 것보단 나음).
  const comparisons: PriceEntry[] = detail?.purchaseLink
    ? [{ platform: deriveShopLabel(detail.purchaseLink), price: deal.price, url: detail.purchaseLink }]
    : [{ platform: "루리웹", price: deal.price, url: deal.link }];

  return {
    body,
    comparisons,
    thumbnailUrl: deal.thumbnailUrl || previewImage || "",
    authorNickname: DISPLAY_ACCOUNT_NICKNAME,
    authorId: DISPLAY_ACCOUNT_ID,
  };
}

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

      const { body, comparisons, thumbnailUrl, authorNickname, authorId } = await buildCrawledDealContent({
        ...deal,
        price: deal.price,
      });

      await createHotdealPost({
        title: deal.title.slice(0, TITLE_MAX_LENGTH),
        body,
        modelName: deal.title.slice(0, MODEL_NAME_MAX_LENGTH),
        authorNickname,
        authorId,
        comparisons,
        source: HOTDEAL_SOURCE.crawled,
        sourceId: deal.sourceId,
        thumbnailUrl,
      });
      createdCount++;
    } catch (err) {
      console.error(`[hotdealCrawlJob] failed to process "${deal.title}":`, err);
    }
  });

  console.log(`[hotdealCrawlJob] done (${createdCount} new post(s), ${skippedNoPrice} skipped for missing price)`);
}
