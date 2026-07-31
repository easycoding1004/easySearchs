import { NextResponse } from "next/server";
import { getKeywordVolumes } from "@/lib/dashboard/keywordVolume";
import {
  getContentProfiles,
  computeExposureScores,
  applyPostCountScores,
  applyPostAnalysisScores,
  buildGapMessages,
  compositeScore,
  type PostAnalysisAverages,
} from "@/lib/dashboard/contentDiagnostics";
import { fetchBlogProfileStats } from "@/lib/naver/blogProfileScraper";
import { fetchPostAnalysis } from "@/lib/naver/blogEngagementScraper";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { MAX_BLOG_SCORE_COMPETITORS, MAX_BLOG_SCORE_KEYWORDS, NOTION_WRITE_CONCURRENCY } from "@/lib/constants";
import { createBlogScoreSession } from "@/lib/notion/blogScoreSessions";
import { createBlogScoreRecord } from "@/lib/notion/blogScoreRecords";
import { getErrorMessage } from "@/lib/utils/errors";
import { createSseStream, SSE_HEADERS } from "@/lib/utils/sse";

function parseList(raw: unknown, max: number): string[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(trimmed);
    if (values.length >= max) break;
  }
  return values;
}

export async function POST(request: Request) {
  let myBlogDomain: string;
  let competitors: string[];
  let keywords: string[];
  try {
    const body = await request.json();
    myBlogDomain = typeof body.myBlogDomain === "string" ? body.myBlogDomain.trim() : "";
    competitors = parseList(body.competitors, MAX_BLOG_SCORE_COMPETITORS);
    keywords = parseList(body.keywords, MAX_BLOG_SCORE_KEYWORDS);
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!myBlogDomain) {
    return NextResponse.json({ error: "내 블로그 주소를 입력해 주세요." }, { status: 400 });
  }

  const { stream, send, close } = createSseStream();

  (async () => {
    try {
      send({ status: "키워드 검색량 조회 중...", progress: 5 });
      const nodes = keywords.length > 0 ? await getKeywordVolumes(keywords) : [];

      send({ status: "검색 노출순위 확인 중...", progress: 15 });
      const profiles = await getContentProfiles(nodes, myBlogDomain, competitors);
      const profileByDomainKey = new Map(profiles.map((p) => [p.domain, p]));
      let scores = computeExposureScores(profiles);

      const domains = [myBlogDomain, ...competitors];
      const profileStatsByDomain = new Map<string, Awaited<ReturnType<typeof fetchBlogProfileStats>>>();
      const analysisByDomain = new Map<string, PostAnalysisAverages | null>();
      const postDetailsByDomain = new Map<string, Awaited<ReturnType<typeof fetchPostAnalysis>>>();
      for (let i = 0; i < domains.length; i++) {
        const domain = domains[i];
        const stepProgress = (offset: number) =>
          20 + Math.round((70 * (i + offset)) / (domains.length * 2));

        send({ status: `"${domain}" 블로그 프로필 확인 중...`, progress: stepProgress(0) });
        try {
          profileStatsByDomain.set(domain, await fetchBlogProfileStats(domain));
        } catch (err) {
          console.error(`[POST /api/blog-score] blog profile fetch failed for "${domain}":`, err);
          profileStatsByDomain.set(domain, null);
        }

        // 최근 게시물 댓글·공감·공유수 + 게시글별 상세(글자수·이미지수 등,
        // "게시글별 분석" 섹션이 결과 페이지에서 같은 캐시로 재사용함) — 한
        // 번의 fetchPostAnalysis 호출이 둘 다 채움(blogEngagementScraper.ts).
        send({ status: `"${domain}" 최근 게시물 댓글·공감·공유 확인 중...`, progress: stepProgress(0.5) });
        try {
          const analysis = await fetchPostAnalysis(domain);
          postDetailsByDomain.set(domain, analysis);
          analysisByDomain.set(
            domain,
            analysis
              ? {
                  avgComments: analysis.avgComments,
                  avgReactions: analysis.avgReactions,
                  avgShares: analysis.avgShares,
                }
              : null
          );
        } catch (err) {
          console.error(`[POST /api/blog-score] post analysis fetch failed for "${domain}":`, err);
          postDetailsByDomain.set(domain, null);
          analysisByDomain.set(domain, null);
        }
      }

      const postCountByDomain = new Map<string, number | null>(
        domains.map((d) => [d, profileStatsByDomain.get(d)?.postCount ?? null])
      );
      scores = applyPostCountScores(scores, postCountByDomain);
      scores = applyPostAnalysisScores(scores, analysisByDomain);
      const gaps = buildGapMessages(scores);

      send({ status: "결과 저장 중...", progress: 92 });

      const sessionId = await createBlogScoreSession({
        title: `${myBlogDomain} - ${new Date().toISOString().slice(0, 10)}`,
        myBlogDomain,
        competitorDomains: competitors,
        keywords,
        gaps,
      });

      // "결과 저장 중..." 이후 진행률 없이 침묵하던 구간 — 경쟁사가 많으면
      // 몇 초씩 걸려 진행바가 멈춘 것처럼 보였음(/api/search와 동일한 문제).
      let savedCount = 0;
      await mapWithConcurrency(scores, NOTION_WRITE_CONCURRENCY, async (score) => {
        const profile = profileStatsByDomain.get(score.domain) ?? null;
        const analysis = analysisByDomain.get(score.domain) ?? null;
        const result = await createBlogScoreRecord({
          sessionId,
          domain: score.domain,
          label: score.label,
          isMine: score.isMine,
          compositeScore: compositeScore(score),
          postVolume: score.postCount,
          exposureRank: score.exposureRank,
          engagement: score.engagement,
          reactionScore: score.reactionScore,
          shareScore: score.shareScore,
          category: profile?.category ?? null,
          todayVisitor: profile?.todayVisitorCount ?? null,
          totalVisitor: profile?.totalVisitorCount ?? null,
          subscriberCount: profile?.subscriberCount ?? null,
          postCount: profile?.postCount ?? null,
          avgRecentComments: analysis?.avgComments ?? null,
          avgRecentReactions: analysis?.avgReactions ?? null,
          avgRecentShares: analysis?.avgShares ?? null,
          topTerms: profileByDomainKey.get(score.domain)?.terms ?? [],
        });
        savedCount++;
        const progress = 92 + Math.round((7 * savedCount) / scores.length);
        send({ status: `결과 저장 중... (${savedCount}/${scores.length})`, progress });
        return result;
      });

      send({ done: true, sessionId, progress: 100 });
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("[POST /api/blog-score] failed:", message, err);
      send({ done: true, error: `블로그지수 조회에 실패했습니다: ${message}` });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
