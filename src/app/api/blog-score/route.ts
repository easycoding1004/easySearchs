import { NextResponse } from "next/server";
import { getKeywordVolumes } from "@/lib/dashboard/keywordVolume";
import {
  getContentProfiles,
  computeRadarScores,
  applyEngagementScores,
  buildGapMessages,
  compositeScore,
} from "@/lib/dashboard/contentDiagnostics";
import { fetchBlogProfileStats } from "@/lib/naver/blogProfileScraper";
import { fetchRecentEngagement } from "@/lib/naver/blogEngagementScraper";
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

      send({ status: "콘텐츠 진단 분석 중...", progress: 15 });
      const profiles = await getContentProfiles(nodes, myBlogDomain, competitors);
      const profileByDomainKey = new Map(profiles.map((p) => [p.domain, p]));
      const baseScores = computeRadarScores(profiles);

      const domains = [myBlogDomain, ...competitors];
      const profileStatsByDomain = new Map<string, Awaited<ReturnType<typeof fetchBlogProfileStats>>>();
      const avgCommentsByDomain = new Map<string, number | null>();
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

        send({ status: `"${domain}" 최근 게시물 댓글 확인 중...`, progress: stepProgress(0.5) });
        try {
          const engagement = await fetchRecentEngagement(domain);
          avgCommentsByDomain.set(domain, engagement?.avgComments ?? null);
        } catch (err) {
          console.error(`[POST /api/blog-score] engagement fetch failed for "${domain}":`, err);
          avgCommentsByDomain.set(domain, null);
        }
      }

      const scores = applyEngagementScores(baseScores, avgCommentsByDomain);
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
        const result = await createBlogScoreRecord({
          sessionId,
          domain: score.domain,
          label: score.label,
          isMine: score.isMine,
          compositeScore: compositeScore(score),
          postVolume: score.postVolume,
          keywordCoverage: score.keywordCoverage,
          highVolumeCoverage: score.highVolumeCoverage,
          lowCompetitionCoverage: score.lowCompetitionCoverage,
          exposureRank: score.exposureRank,
          freshness: score.freshness,
          engagement: score.engagement,
          category: profile?.category ?? null,
          todayVisitor: profile?.todayVisitorCount ?? null,
          totalVisitor: profile?.totalVisitorCount ?? null,
          subscriberCount: profile?.subscriberCount ?? null,
          postCount: profile?.postCount ?? null,
          avgRecentComments: avgCommentsByDomain.get(score.domain) ?? null,
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
