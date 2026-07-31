import { NextResponse } from "next/server";
import { fetchPostAnalysis } from "@/lib/naver/blogEngagementScraper";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { MAX_BLOG_SCORE_COMPETITORS } from "@/lib/constants";
import { createSseStream, SSE_HEADERS } from "@/lib/utils/sse";
import { getErrorMessage } from "@/lib/utils/errors";
import type { PostAnalysisEntry } from "@/components/dashboard/PostAnalysisPanel";

// 도메인당 게시글을 최대 몇 개까지 볼지는 blogEngagementScraper.ts의
// RECENT_POST_SAMPLE(50)이 정하는데, 여기서는 그 값을 몰라도(export 안 됨)
// 진행률 분모의 초기 추정치로만 쓴다 — 실제 rssItems 길이를 알게 되면
// (fetchPostAnalysis의 onPostDone 콜백) 바로 정확한 값으로 갱신됨.
const ESTIMATED_POSTS_PER_DOMAIN = 50;
const CONCURRENCY = 3;

interface DomainInput {
  domain: string;
  label: string;
  isMine: boolean;
}

function parseDomains(raw: unknown): DomainInput[] {
  if (!Array.isArray(raw)) return [];
  const values: DomainInput[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as DomainInput).domain === "string" &&
      typeof (item as DomainInput).label === "string" &&
      typeof (item as DomainInput).isMine === "boolean"
    ) {
      values.push(item as DomainInput);
    }
    if (values.length >= MAX_BLOG_SCORE_COMPETITORS + 1) break;
  }
  return values;
}

// "게시글별 분석"의 실시간 진행바용 SSE 엔드포인트(2026-07 추가) — 도메인당
// 최대 50개 게시글을 순차 스크래핑하다 보니(§blogEngagementScraper.ts) 세션
// 생성 직후가 아닌 재방문 시 이 섹션 하나가 수십 초~몇 분 걸릴 수 있어서,
// 정적 스켈레톤 대신 실제 진행 상태를 보여주기 위해 이 섹션만 클라이언트
// 컴포넌트(PostAnalysisLive.tsx)가 직접 이 라우트를 호출하는 방식으로 뺌
// (나머지 "메인" 탭은 그대로 RSC Suspense 스트리밍).
export async function POST(request: Request) {
  let domains: DomainInput[];
  try {
    const body = await request.json();
    domains = parseDomains(body.domains);
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const { stream, send, close } = createSseStream();

  (async () => {
    try {
      if (domains.length === 0) {
        send({ done: true, entries: [] });
        return;
      }

      // 도메인별 진행 상태를 모아 전체 퍼센트를 계산 — 동시에 여러 도메인이
      // 진행되므로(CONCURRENCY) 도메인 단위가 아니라 게시글 단위로 합산해야
      // 진행바가 매끄럽게 움직임(도메인 하나 끝날 때만 훅 뛰는 대신).
      const progressByDomain = new Map<string, { done: number; total: number }>(
        domains.map((d) => [d.domain, { done: 0, total: ESTIMATED_POSTS_PER_DOMAIN }])
      );

      function reportProgress(domain: string, done: number, total: number) {
        progressByDomain.set(domain, { done, total });
        let doneSum = 0;
        let totalSum = 0;
        for (const v of progressByDomain.values()) {
          doneSum += v.done;
          totalSum += v.total;
        }
        const progress = totalSum > 0 ? Math.min(99, Math.round((100 * doneSum) / totalSum)) : 0;
        send({ status: `"${domain}" 게시글 ${done}/${total} 확인 중...`, progress });
      }

      const entries = await mapWithConcurrency(domains, CONCURRENCY, async (d): Promise<PostAnalysisEntry> => {
        try {
          const analysis = await fetchPostAnalysis(d.domain, (done, total) =>
            reportProgress(d.domain, done, total)
          );
          return { ...d, analysis };
        } catch (err) {
          console.error(`[POST /api/post-analysis] failed for "${d.domain}":`, err);
          return { ...d, analysis: null };
        }
      });

      send({ done: true, entries, progress: 100 });
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("[POST /api/post-analysis] failed:", message, err);
      send({ done: true, error: `게시글별 분석에 실패했습니다: ${message}` });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
