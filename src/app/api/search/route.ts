import { NextResponse } from "next/server";
import { fetchKeywordStats } from "@/lib/naver/client";
import { expandSparseKeywords } from "@/lib/naver/keywordExpansion";
import { getBlogPublishStats, type BlogPublishStats } from "@/lib/naver/blogPublishStats";
import type { NormalizedKeywordRow } from "@/lib/naver/types";
import {
  INDEX_WAIT_DELAY_MS,
  INDEX_WAIT_MAX_ATTEMPTS,
  MAX_KEYWORD_RESULTS,
  MAX_SEED_KEYWORDS,
  NOTION_WRITE_CONCURRENCY,
} from "@/lib/constants";
import { createSearchSession } from "@/lib/notion/sessions";
import { createKeywordRecord, getRecordsForSession } from "@/lib/notion/records";
import { upsertSnapshot } from "@/lib/notion/keywordSnapshots";
import { KEYWORD_KIND, SNAPSHOT_SOURCE } from "@/lib/notion/schema";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { getErrorMessage } from "@/lib/utils/errors";
import { createSseStream, SSE_HEADERS } from "@/lib/utils/sse";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Notion's query index is eventually consistent — a page created a moment
// ago can be briefly missing from a dataSources.query() result. Poll until
// the expected record count shows up (or give up after a few tries) so the
// result page has complete data on first load instead of requiring a
// manual refresh.
async function waitForRecordsIndexed(sessionId: string, expectedCount: number) {
  for (let attempt = 0; attempt < INDEX_WAIT_MAX_ATTEMPTS; attempt++) {
    const records = await getRecordsForSession(sessionId);
    if (records.length >= expectedCount) return;
    await sleep(INDEX_WAIT_DELAY_MS);
  }
  console.warn(
    `[POST /api/search] Notion index not caught up after ${INDEX_WAIT_MAX_ATTEMPTS} attempts for session ${sessionId} (expected ${expectedCount} records)`
  );
}

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = normalizeForMatch(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(trimmed);
  }
  return keywords;
}

interface TaggedRow {
  row: NormalizedKeywordRow;
  isSeed: boolean;
  isInferred: boolean;
}

// Every keyword the user explicitly asked for is tagged as a seed — Naver
// only auto-suggests related keywords for popular terms, so for niche/local
// keywords the user's own list is often the entire "cluster".
function tagSeedRows(
  rows: NormalizedKeywordRow[],
  inputKeywords: string[]
): TaggedRow[] {
  const targets = new Set(inputKeywords.map(normalizeForMatch));
  const tagged = rows.map((row) => ({
    row,
    isSeed: targets.has(normalizeForMatch(row.relKeyword)),
    isInferred: false,
  }));

  if (tagged.some((entry) => entry.isSeed)) return tagged;

  // Naver returned rows but none matched our input strings exactly (rare
  // normalization mismatch) — fall back to treating the first row as seed
  // so the session always has at least one.
  return tagged.map((entry, index) => ({ ...entry, isSeed: index === 0 }));
}

function totalCount(row: NormalizedKeywordRow): number {
  return row.monthlyPcQcCnt + row.monthlyMobileQcCnt;
}

export async function POST(request: Request) {
  let keywords: string[];
  try {
    const body = await request.json();
    const raw = typeof body.keyword === "string" ? body.keyword : "";
    keywords = parseKeywords(raw);
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (keywords.length === 0) {
    return NextResponse.json({ error: "키워드를 입력해 주세요." }, { status: 400 });
  }

  if (keywords.length > MAX_SEED_KEYWORDS) {
    return NextResponse.json(
      { error: `키워드는 최대 ${MAX_SEED_KEYWORDS}개까지 입력할 수 있습니다.` },
      { status: 400 }
    );
  }

  const { stream, send, close } = createSseStream();

  (async () => {
    try {
      send({ status: "네이버 키워드 검색량 조회 중...", progress: 5 });

      // hintKeywords 파라미터는 공백이 섞이면 400 에러를 낸다(실측 확인) — 화면
      // 표시/Notion 라벨은 사용자가 입력한 그대로(keywords) 쓰고, 네이버 호출에만
      // 공백을 제거한 버전을 씀.
      const hintKeywords = keywords.map((k) => k.replace(/\s+/g, "")).join(",");

      let rawRows: NormalizedKeywordRow[];
      try {
        rawRows = await fetchKeywordStats(hintKeywords);
      } catch (err) {
        const message = getErrorMessage(err);
        console.error("[POST /api/search] Naver API call failed:", message, err);
        send({ done: true, error: `네이버 키워드 API 호출에 실패했습니다: ${message}` });
        return;
      }

      console.log(
        `[POST /api/search] Naver returned ${rawRows.length} row(s) for keywords: ${keywords.join(", ")} (showing top 5 by search volume)`
      );
      console.table([...rawRows].sort((a, b) => totalCount(b) - totalCount(a)).slice(0, 5));

      if (rawRows.length === 0) {
        console.warn(`[POST /api/search] No results from Naver for keywords: ${keywords.join(", ")}`);
        send({ done: true, error: "검색 결과가 없습니다." });
        return;
      }

      const tagged = tagSeedRows(rawRows, keywords);

      // Single-keyword searches with a sparse related-keyword list get padded
      // with seed+modifier combinations looked up for real search-volume data
      // (see keywordExpansion.ts) — skipped for multi-keyword searches since
      // those already use up Naver's 5-hint-keyword-per-call budget.
      if (keywords.length === 1) {
        const relatedCount = tagged.filter((entry) => !entry.isSeed).length;
        if (relatedCount < 5) {
          send({ status: "연관 키워드가 적어 추가 키워드를 찾는 중...", progress: 8 });
          const added = await expandSparseKeywords(
            keywords[0],
            tagged.map((entry) => entry.row)
          );
          for (const row of added) {
            tagged.push({ row, isSeed: false, isInferred: true });
          }
        }
      }

      const sorted = [...tagged].sort((a, b) => totalCount(b.row) - totalCount(a.row));

      const capped = sorted.slice(0, MAX_KEYWORD_RESULTS);
      const missingSeeds = tagged.filter((entry) => entry.isSeed && !capped.includes(entry));
      capped.push(...missingSeeds);

      // One extra blog search per keyword (총 발행량/월간 발행량/포화도) —
      // sequential so each one can report which keyword is currently being
      // checked, since Naver's shared rate limit already serializes these.
      const publishStats = new Map<string, BlogPublishStats>();
      for (let i = 0; i < capped.length; i++) {
        const entry = capped[i];
        const progress = capped.length > 0 ? 10 + Math.round((80 * i) / capped.length) : 90;
        send({ status: `"${entry.row.relKeyword}" 블로그 발행량 확인 중...`, progress });
        try {
          publishStats.set(entry.row.relKeyword, await getBlogPublishStats(entry.row.relKeyword));
        } catch (err) {
          console.error(`[POST /api/search] blog publish stats failed for "${entry.row.relKeyword}":`, err);
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      const keywordLabel = keywords.join(", ");

      send({ status: "결과 저장 중...", progress: 92 });

      let sessionId: string;
      try {
        sessionId = await createSearchSession({
          title: `${keywordLabel} - ${today}`,
          keyword: keywordLabel,
          resultCount: capped.length,
        });
      } catch (err) {
        const message = getErrorMessage(err);
        console.error("[POST /api/search] Notion session creation failed:", message, err);
        send({ done: true, error: `Notion 세션 생성에 실패했습니다: ${message}` });
        return;
      }

      // 진행률을 계속 보내야 하는 이유: 결과가 많으면(인기 시드 키워드는 연관
      // 키워드가 50개까지 붙음) 이 저장 단계만 여러 초가 걸리는데, 여기서 SSE를
      // 하나도 안 보내면 클라이언트 진행바가 92%에서 멈춘 것처럼 보임(실측 확인
      // — "카페" 검색 시 이 구간에서만 7초 넘게 무응답).
      let savedCount = 0;
      try {
        await mapWithConcurrency(capped, NOTION_WRITE_CONCURRENCY, async (entry) => {
          await createKeywordRecord({
            sessionId,
            row: entry.row,
            kind: entry.isSeed
              ? KEYWORD_KIND.seed
              : entry.isInferred
                ? KEYWORD_KIND.inferred
                : KEYWORD_KIND.related,
            blogPublishStats: publishStats.get(entry.row.relKeyword) ?? null,
          });
          savedCount++;
          const progress = 92 + Math.round((7 * savedCount) / capped.length);
          send({ status: `결과 저장 중... (${savedCount}/${capped.length})`, progress });
        });
      } catch (err) {
        const message = getErrorMessage(err);
        console.error("[POST /api/search] Notion record creation failed:", message, err);
        send({ done: true, error: `Notion 레코드 저장에 실패했습니다: ${message}` });
        return;
      }

      // Best-effort, not awaited — feeds /trending's self-accumulated "우리
      // 데이터 기준 상승 키워드" history. Never blocks or fails the search.
      mapWithConcurrency(capped, NOTION_WRITE_CONCURRENCY, (entry) =>
        upsertSnapshot(
          entry.row.relKeyword,
          entry.row.monthlyPcQcCnt,
          entry.row.monthlyMobileQcCnt,
          SNAPSHOT_SOURCE.userSearch
        )
      ).catch((err) => {
        console.error("[POST /api/search] snapshot upsert failed:", getErrorMessage(err), err);
      });

      send({ status: "저장 확인 중...", progress: 99 });
      await waitForRecordsIndexed(sessionId, capped.length);

      send({ done: true, sessionId, progress: 100 });
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("[POST /api/search] unexpected failure:", message, err);
      send({ done: true, error: `검색 중 오류가 발생했습니다: ${message}` });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
