import { Resend } from "resend";
import { fetchKeywordStats } from "../naver/client";
import { getAllKeywordWatches, recordKeywordWatchNotified, type KeywordWatch } from "../notion/keywordWatches";
import { findUserByPageId } from "../notion/users";
import { KEYWORD_WATCH_CHANGE_THRESHOLD, KEYWORD_WATCH_BATCH_SIZE, KEYWORD_WATCH_JOB_CONCURRENCY } from "../constants";
import { mapWithConcurrency } from "../utils/concurrency";

const SITE_URL = "https://ezzsearch.com";

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Trigger {
  watch: KeywordWatch;
  currentCount: number;
  changeRatio: number;
}

// 등록된 모든 관심 키워드의 현재 검색량을 조회해 Map<정규화된 키워드,
// 합계검색량>으로 돌려줌. 네이버 검색광고 키워드도구 API는 hintKeywords를
// 한 번에 최대 5개까지만 받으므로(§KEYWORD_WATCH_BATCH_SIZE) 청크로 나눠
// 순차 호출 — 이 잡은 하루 1회, 등록자도 소수일 것으로 예상돼 병렬화하지
// 않음(§CLAUDE.md 15의 "새로 느린 검색 기능을 만들 때 스로틀을 우회하려
// 하지 말 것" 원칙과 같은 결로 보수적으로 감).
async function fetchCurrentCounts(keywords: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const group of chunk(keywords, KEYWORD_WATCH_BATCH_SIZE)) {
    // §CLAUDE.md 15 — hintKeywords는 공백이 섞이면 400 에러라 반드시 제거.
    const hintKeywords = group.map((k) => k.replace(/\s+/g, "")).join(",");
    try {
      const rows = await fetchKeywordStats(hintKeywords);
      const wanted = new Set(group.map(normalizeForMatch));
      for (const row of rows) {
        const key = normalizeForMatch(row.relKeyword);
        if (wanted.has(key)) counts.set(key, row.monthlyPcQcCnt + row.monthlyMobileQcCnt);
      }
    } catch (err) {
      console.error(`[keywordWatchJob] fetchKeywordStats failed for group [${group.join(", ")}]:`, err);
    }
  }
  return counts;
}

function buildEmailHtml(triggers: Trigger[]): string {
  const rows = triggers
    .map(({ watch, currentCount, changeRatio }) => {
      const pct = Math.round(changeRatio * 100);
      const baseline = watch.lastNotifiedCount ?? watch.baselineCount;
      return `<li style="margin-bottom:8px;">
        <strong>${escapeHtml(watch.keyword)}</strong> — ${baseline.toLocaleString()} → ${currentCount.toLocaleString()}
        (<span style="color:${pct > 0 ? "#4B8B5F" : "#C94F4F"};font-weight:600;">${pct > 0 ? "+" : ""}${pct}%</span>)
      </li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko">
<body style="font-family:-apple-system,'Noto Sans KR',sans-serif;color:#3D2E1F;background:#FFFBF7;padding:24px;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="font-size:20px;font-weight:800;color:#E06B3D;margin:0 0 24px;">이지서치</p>
    <h1 style="font-size:22px;margin:0 0 16px;">등록하신 관심 키워드에 변화가 있어요</h1>
    <ul style="padding-left:20px;margin:0;">${rows}</ul>
    <p style="margin:32px 0 0;">
      <a href="${SITE_URL}/mypage" style="display:inline-block;background:#E06B3D;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;">
        내 관심 키워드 보기
      </a>
    </p>
    <p style="margin-top:40px;font-size:12px;color:#8A7B6C;">
      더 이상 받고 싶지 않으시면 내 정보 &gt; 관심 키워드에서 해지할 수 있어요.
    </p>
  </div>
</body>
</html>`;
}

// setInterval 기반(newsletterJob/billingJob과 같은 패턴, instrumentation.ts에서
// 등록) — 서버 시작 시 즉시 실행하지 않음(재배포마다 회원에게 메일이
// 나가면 안 되므로).
export async function runKeywordWatchJob(): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[keywordWatchJob] Missing RESEND_API_KEY, skipping");
    return;
  }

  const watches = await getAllKeywordWatches();
  if (watches.length === 0) {
    console.log("[keywordWatchJob] no watches, skipping");
    return;
  }

  const uniqueKeywords = [...new Set(watches.map((w) => w.keyword))];
  const counts = await fetchCurrentCounts(uniqueKeywords);

  const triggersByAuthor = new Map<string, Trigger[]>();
  for (const watch of watches) {
    const currentCount = counts.get(normalizeForMatch(watch.keyword));
    if (currentCount == null) continue;

    const baseline = watch.lastNotifiedCount ?? watch.baselineCount;
    if (baseline <= 0) continue; // 0으로 나누기 방지 — getRisingKeywords와 동일한 안전장치

    const changeRatio = (currentCount - baseline) / baseline;
    if (Math.abs(changeRatio) < KEYWORD_WATCH_CHANGE_THRESHOLD) continue;

    const list = triggersByAuthor.get(watch.authorId) ?? [];
    list.push({ watch, currentCount, changeRatio });
    triggersByAuthor.set(watch.authorId, list);
  }

  if (triggersByAuthor.size === 0) {
    console.log("[keywordWatchJob] no threshold-crossing keywords today");
    return;
  }

  const resend = new Resend(apiKey);
  console.log(`[keywordWatchJob] notifying ${triggersByAuthor.size} user(s)`);

  await mapWithConcurrency(
    [...triggersByAuthor.entries()],
    KEYWORD_WATCH_JOB_CONCURRENCY,
    async ([authorId, triggers]) => {
      try {
        const user = await findUserByPageId(authorId);
        if (!user || !user.email) return;

        const { error } = await resend.emails.send({
          from: "이지서치 관심 키워드 <trending@ezzsearch.com>",
          to: user.email,
          subject: `관심 키워드 ${triggers.length}건에 변화가 있어요`,
          html: buildEmailHtml(triggers),
        });
        if (error) throw new Error(error.message);

        await Promise.all(
          triggers.map((t) => recordKeywordWatchNotified(t.watch.pageId, t.currentCount))
        );
      } catch (err) {
        console.error(`[keywordWatchJob] notify failed for author ${authorId}:`, err);
      }
    }
  );

  console.log("[keywordWatchJob] done");
}
