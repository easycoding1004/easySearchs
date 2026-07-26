import { Resend } from "resend";
import { fetchTrendingKeywordsWithNaverVolume, type TrendingKeywordWithVolume } from "../googleTrends/client";
import { getRisingKeywords, type RisingKeyword } from "../notion/keywordSnapshots";
import { getAllSubscribers } from "../notion/subscribers";
import { RISING_KEYWORD_MIN_DAYS, NEWSLETTER_SEND_CONCURRENCY } from "../constants";
import { mapWithConcurrency } from "../utils/concurrency";
import { getKstDateString } from "../utils/formatDate";

const SITE_URL = "https://ezzsearch.com";
const MAX_ITEMS_PER_SECTION = 5;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function trendingListHtml(items: TrendingKeywordWithVolume[]): string {
  if (items.length === 0) return "<p>이번 주엔 표시할 항목이 없어요.</p>";
  return `<ol style="padding-left:20px;margin:0;">${items
    .slice(0, MAX_ITEMS_PER_SECTION)
    .map((item) => {
      const volume =
        item.naverPcCount != null && item.naverMobileCount != null
          ? `${(item.naverPcCount + item.naverMobileCount).toLocaleString()}회 검색`
          : "네이버 검색량 확인 안 됨";
      return `<li style="margin-bottom:6px;">${escapeHtml(item.title)} — ${volume}</li>`;
    })
    .join("")}</ol>`;
}

function risingListHtml(items: RisingKeyword[]): string {
  if (items.length === 0) return "<p>아직 충분한 데이터가 쌓이지 않았어요.</p>";
  return `<ol style="padding-left:20px;margin:0;">${items
    .slice(0, MAX_ITEMS_PER_SECTION)
    .map((item) => {
      const pct = Math.round(item.changeRatio * 100);
      return `<li style="margin-bottom:6px;">${escapeHtml(item.keyword)} — ${item.earliestCount.toLocaleString()} → ${item.latestCount.toLocaleString()} (${pct > 0 ? "+" : ""}${pct}%)</li>`;
    })
    .join("")}</ol>`;
}

function buildEmailHtml(
  trending: TrendingKeywordWithVolume[],
  rising: RisingKeyword[],
  unsubscribeUrl: string
): string {
  return `<!doctype html>
<html lang="ko">
<body style="font-family:-apple-system,'Noto Sans KR',sans-serif;color:#3D2E1F;background:#FFFBF7;padding:24px;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="font-size:20px;font-weight:800;color:#E06B3D;margin:0 0 24px;">ezzsearch</p>
    <h1 style="font-size:22px;margin:0 0 16px;">이번 주 급상승 키워드</h1>

    <h2 style="font-size:16px;margin:24px 0 8px;">요즘 뜨는 검색어</h2>
    ${trendingListHtml(trending)}

    <h2 style="font-size:16px;margin:24px 0 8px;">우리 데이터 기준 상승 키워드</h2>
    ${risingListHtml(rising)}

    <p style="margin:32px 0 0;">
      <a href="${SITE_URL}/trending" style="display:inline-block;background:#E06B3D;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;">
        급상승 키워드 전체 보기
      </a>
    </p>

    <p style="margin-top:40px;font-size:12px;color:#8A7B6C;">
      더 이상 받고 싶지 않으시면 <a href="${unsubscribeUrl}" style="color:#8A7B6C;">여기서 구독 해지</a>하실 수 있어요.
    </p>
  </div>
</body>
</html>`;
}

// setInterval 기반(snapshotJob과 동일 패턴, instrumentation.ts에서 등록) —
// 서버 시작 시 즉시 발송하지 않고 주기 도달 시에만 발송하므로 재배포 자체가
// 스팸이 되진 않지만, 반대로 이 주기(NEWSLETTER_JOB_INTERVAL_MS)보다 자주
// 재배포되는 환경에서는 발송이 아예 안 나갈 수 있음 — 별도 발송 이력 저장소
// 없이 가동 시간에만 의존하는 정직한 트레이드오프(CLAUDE.md §6.4 참고).
export async function runNewsletterJob(): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[newsletterJob] Missing RESEND_API_KEY, skipping send");
    return;
  }

  let trending: TrendingKeywordWithVolume[] = [];
  try {
    trending = await fetchTrendingKeywordsWithNaverVolume();
  } catch (err) {
    console.error("[newsletterJob] trending fetch failed:", err);
  }

  let rising: RisingKeyword[] = [];
  try {
    rising = await getRisingKeywords(RISING_KEYWORD_MIN_DAYS);
  } catch (err) {
    console.error("[newsletterJob] rising keywords fetch failed:", err);
  }

  const subscribers = await getAllSubscribers();
  if (subscribers.length === 0) {
    console.log("[newsletterJob] no subscribers, skipping send");
    return;
  }

  const resend = new Resend(apiKey);
  const dateLabel = getKstDateString();
  console.log(`[newsletterJob] sending to ${subscribers.length} subscriber(s)`);

  let sentCount = 0;
  await mapWithConcurrency(subscribers, NEWSLETTER_SEND_CONCURRENCY, async (subscriber) => {
    const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${subscriber.unsubscribeToken}`;
    try {
      const { error } = await resend.emails.send({
        from: "ezzsearch 급상승 키워드 <trending@ezzsearch.com>",
        to: subscriber.email,
        subject: `이번 주 급상승 키워드 (${dateLabel})`,
        html: buildEmailHtml(trending, rising, unsubscribeUrl),
      });
      if (error) throw new Error(error.message);
      sentCount++;
    } catch (err) {
      console.error(`[newsletterJob] send failed for a subscriber:`, err);
    }
  });

  console.log(`[newsletterJob] done (${sentCount}/${subscribers.length} sent)`);
}
