import { notFound } from "next/navigation";
import { getBlogScoreSessionById } from "@/lib/notion/blogScoreSessions";
import { getRecordsForBlogScoreSession } from "@/lib/notion/blogScoreRecords";
import { getKeywordVolumes } from "@/lib/dashboard/keywordVolume";
import { getBlogPublishStatsForKeywords } from "@/lib/naver/blogPublishStats";
import { getMentionVolume } from "@/lib/mentions";
import { getDashboardExposure } from "@/lib/dashboardExposure";
import { getCompetitorKeywordProfiles } from "@/lib/competitorKeywords";
import { recommendTitleAndTags, sortByVolumeDesc, MAX_CLUSTER_NODES } from "@/lib/keywordCluster";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { NAVER_OPENAPI_CONCURRENCY } from "@/lib/constants";
import type { RadarScore } from "@/lib/contentDiagnostics";
import type { BlogProfileStats } from "@/lib/naver/blogProfileScraper";

import KeywordVolumePanel from "@/components/dashboard/KeywordVolumePanel";
import MentionVolumePanel from "@/components/dashboard/MentionVolumePanel";
import CompetitorExposurePanel from "@/components/dashboard/CompetitorExposurePanel";
import KeywordClusterPanel from "@/components/dashboard/KeywordClusterPanel";
import BlogScorePanel from "@/components/dashboard/BlogScorePanel";
import DatalabTrendPanel from "@/components/dashboard/DatalabTrendPanel";
import PanelError from "@/components/dashboard/PanelError";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import ExportableImage from "@/components/dashboard/ExportableImage";

export const dynamic = "force-dynamic";

// Ephemeral, one-off per search — shouldn't compete for search-result
// placement against the evergreen landing pages.
export const metadata = {
  robots: { index: false, follow: false },
};

async function settle<T>(fetcher: () => Promise<T>) {
  try {
    return { ok: true as const, value: await fetcher() };
  } catch (err) {
    console.error("[BlogScoreResultPage] panel fetch failed:", err);
    return { ok: false as const };
  }
}

export default async function BlogScoreResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const session = await getBlogScoreSessionById(sessionId);
  if (!session) notFound();

  const records = await getRecordsForBlogScoreSession(sessionId);

  const scores: RadarScore[] = records.map((r) => ({
    domain: r.domain,
    label: r.label,
    isMine: r.isMine,
    postVolume: r.postVolume,
    keywordCoverage: r.keywordCoverage,
    highVolumeCoverage: r.highVolumeCoverage,
    lowCompetitionCoverage: r.lowCompetitionCoverage,
    exposureRank: r.exposureRank,
    freshness: r.freshness,
    engagement: r.engagement,
  }));

  const profileStats: Record<string, BlogProfileStats | null> = {};
  const avgRecentComments: Record<string, number | null> = {};
  const topTerms: Record<string, { term: string; count: number }[]> = {};
  for (const r of records) {
    profileStats[r.domain] = {
      blogId: r.domain,
      category: r.category,
      subscriberCount: r.subscriberCount,
      todayVisitorCount: r.todayVisitor,
      totalVisitorCount: r.totalVisitor,
      postCount: r.postCount,
    };
    avgRecentComments[r.domain] = r.avgRecentComments;
    topTerms[r.domain] = r.topTerms;
  }

  // "키워드 노출·빈도" tab is live-fetched on every view rather than stored
  // in Notion like the 블로그지수 tab — secondary/lower-priority data, and
  // storing it would need several more Notion databases. Trade-off: revisits
  // re-run these Naver calls instead of showing a fixed snapshot.
  const volumeResult = await settle(() => getKeywordVolumes(session.keywords));
  const publishStatsResult = await settle(() => getBlogPublishStatsForKeywords(session.keywords));
  const mentionResult = await settle(() =>
    mapWithConcurrency(session.keywords, NAVER_OPENAPI_CONCURRENCY, getMentionVolume)
  );
  const exposureResult = await settle(() =>
    getDashboardExposure(session.keywords, session.competitorDomains)
  );
  const clusterResult = await settle(async () => {
    const nodes = volumeResult.ok
      ? sortByVolumeDesc(volumeResult.value).slice(0, MAX_CLUSTER_NODES)
      : [];
    const recommendation = recommendTitleAndTags(nodes);
    const competitorProfiles = await getCompetitorKeywordProfiles(
      nodes.map((n) => n.relKeyword),
      session.competitorDomains
    );
    return { nodes, recommendation, competitorProfiles };
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{session.myBlogDomain}</h1>
        <p className="text-sm text-ink-muted">
          키워드 {session.keywords.length}개 · 비교 블로그 {session.competitorDomains.length}곳 ·{" "}
          {new Date(session.searchedAt).toLocaleString("ko-KR")} 조회
        </p>
      </div>

      <DashboardTabs
        tabs={[
          {
            id: "main",
            label: "메인 (블로그지수)",
            content: (
              <ExportableImage
                fileName={`블로그지수-${session.myBlogDomain.replace(/[^a-zA-Z0-9가-힣.-]/g, "_")}`}
              >
                <BlogScorePanel
                  scores={scores}
                  gaps={session.gaps}
                  fetchedAt={session.searchedAt}
                  profileStats={profileStats}
                  avgRecentComments={avgRecentComments}
                  topTerms={topTerms}
                />
              </ExportableImage>
            ),
          },
          {
            id: "exposure",
            label: "키워드 노출·빈도",
            content: (
              <>
                {volumeResult.ok ? (
                  <KeywordVolumePanel
                    rows={volumeResult.value}
                    publishStats={publishStatsResult.ok ? publishStatsResult.value : {}}
                    fetchedAt={session.searchedAt}
                  />
                ) : (
                  <PanelError title="키워드 검색량" />
                )}
                {mentionResult.ok ? (
                  <MentionVolumePanel rows={mentionResult.value} fetchedAt={session.searchedAt} />
                ) : (
                  <PanelError title="블로그·카페 언급량" />
                )}
                {exposureResult.ok ? (
                  <CompetitorExposurePanel
                    results={exposureResult.value}
                    competitors={session.competitorDomains}
                    fetchedAt={session.searchedAt}
                  />
                ) : (
                  <PanelError title="경쟁업체 블로그 노출 순위" />
                )}
                {clusterResult.ok ? (
                  <KeywordClusterPanel
                    seed={session.keywords[0]}
                    nodes={clusterResult.value.nodes}
                    inferredKeywords={[]}
                    recommendation={clusterResult.value.recommendation}
                    competitorProfiles={clusterResult.value.competitorProfiles}
                    fetchedAt={session.searchedAt}
                  />
                ) : (
                  <PanelError title="키워드 클러스터 & 콘텐츠 전략" />
                )}
                <DatalabTrendPanel status="pending_approval" />
              </>
            ),
          },
        ]}
      />
    </main>
  );
}
