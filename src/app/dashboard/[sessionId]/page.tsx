import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBlogScoreSessionById } from "@/lib/notion/blogScoreSessions";
import { getRecordsForBlogScoreSession } from "@/lib/notion/blogScoreRecords";
import { getKeywordVolumes } from "@/lib/dashboard/keywordVolume";
import { getBlogPublishStatsForKeywords } from "@/lib/naver/blogPublishStats";
import { getMentionVolume } from "@/lib/dashboard/mentions";
import { getDashboardExposure } from "@/lib/dashboard/dashboardExposure";
import { getCompetitorKeywordProfiles } from "@/lib/dashboard/competitorKeywords";
import { recommendTitleAndTags, sortByVolumeDesc, MAX_CLUSTER_NODES } from "@/lib/dashboard/keywordCluster";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { formatKstDateTime } from "@/lib/utils/formatDate";
import { NAVER_OPENAPI_CONCURRENCY } from "@/lib/constants";
import type { RadarScore } from "@/lib/dashboard/contentDiagnostics";
import type { BlogProfileStats } from "@/lib/naver/blogProfileScraper";

import KeywordVolumePanel from "@/components/dashboard/KeywordVolumePanel";
import MentionVolumePanel from "@/components/dashboard/MentionVolumePanel";
import CompetitorExposurePanel from "@/components/dashboard/CompetitorExposurePanel";
import KeywordClusterPanel from "@/components/dashboard/KeywordClusterPanel";
import BlogScorePanel from "@/components/dashboard/BlogScorePanel";
import PanelError from "@/components/dashboard/PanelError";
import PanelSkeleton from "@/components/dashboard/PanelSkeleton";
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

// "키워드 노출·빈도" tab is live-fetched on every view rather than stored in
// Notion like the 블로그지수 tab (below) — secondary/lower-priority data,
// and storing it would need several more Notion databases. Each panel below
// is its own async component wrapped in <Suspense> so a session with many
// keywords/competitors doesn't block the whole page (including the already-
// computed 메인 tab, which only needs two Notion reads) behind the slowest
// one — they stream in independently as each finishes instead of holding up
// loading.tsx until every Naver call across all four panels is done.

async function KeywordVolumeSection({
  keywords,
  fetchedAt,
}: {
  keywords: string[];
  fetchedAt: string;
}) {
  const [volumeResult, publishStatsResult] = await Promise.all([
    settle(() => getKeywordVolumes(keywords)),
    settle(() => getBlogPublishStatsForKeywords(keywords)),
  ]);
  if (!volumeResult.ok) return <PanelError title="키워드 검색량" />;
  return (
    <KeywordVolumePanel
      rows={volumeResult.value}
      publishStats={publishStatsResult.ok ? publishStatsResult.value : {}}
      fetchedAt={fetchedAt}
    />
  );
}

async function MentionVolumeSection({
  keywords,
  fetchedAt,
}: {
  keywords: string[];
  fetchedAt: string;
}) {
  const result = await settle(() =>
    mapWithConcurrency(keywords, NAVER_OPENAPI_CONCURRENCY, getMentionVolume)
  );
  if (!result.ok) return <PanelError title="블로그·카페 언급량" />;
  return <MentionVolumePanel rows={result.value} fetchedAt={fetchedAt} />;
}

async function CompetitorExposureSection({
  keywords,
  competitorDomains,
  fetchedAt,
}: {
  keywords: string[];
  competitorDomains: string[];
  fetchedAt: string;
}) {
  const result = await settle(() => getDashboardExposure(keywords, competitorDomains));
  if (!result.ok) return <PanelError title="경쟁업체 블로그 노출 순위" />;
  return (
    <CompetitorExposurePanel
      results={result.value}
      competitors={competitorDomains}
      fetchedAt={fetchedAt}
    />
  );
}

async function KeywordClusterSection({
  keywords,
  competitorDomains,
  seed,
  fetchedAt,
}: {
  keywords: string[];
  competitorDomains: string[];
  seed: string;
  fetchedAt: string;
}) {
  const result = await settle(async () => {
    // getKeywordVolumes is cache()'d, so calling it again here (in parallel
    // with KeywordVolumeSection's own call, same keywords array) reuses that
    // panel's batched keywordstool calls instead of redoing them.
    const volumeResult = await settle(() => getKeywordVolumes(keywords));
    const nodes = volumeResult.ok
      ? sortByVolumeDesc(volumeResult.value).slice(0, MAX_CLUSTER_NODES)
      : [];
    const recommendation = recommendTitleAndTags(nodes);
    const competitorProfiles = await getCompetitorKeywordProfiles(
      nodes.map((n) => n.relKeyword),
      competitorDomains
    );
    return { nodes, recommendation, competitorProfiles };
  });
  if (!result.ok) return <PanelError title="키워드 클러스터 & 콘텐츠 전략" />;
  return (
    <KeywordClusterPanel
      seed={seed}
      nodes={result.value.nodes}
      inferredKeywords={[]}
      recommendation={result.value.recommendation}
      competitorProfiles={result.value.competitorProfiles}
      fetchedAt={fetchedAt}
    />
  );
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{session.myBlogDomain}</h1>
        <p className="text-sm text-ink-muted">
          키워드 {session.keywords.length}개 · 비교 블로그 {session.competitorDomains.length}곳 ·{" "}
          {formatKstDateTime(session.searchedAt)} 조회
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
                <Suspense fallback={<PanelSkeleton title="키워드 검색량" />}>
                  <KeywordVolumeSection keywords={session.keywords} fetchedAt={session.searchedAt} />
                </Suspense>
                <Suspense fallback={<PanelSkeleton title="블로그·카페 언급량" />}>
                  <MentionVolumeSection keywords={session.keywords} fetchedAt={session.searchedAt} />
                </Suspense>
                <Suspense fallback={<PanelSkeleton title="경쟁업체 블로그 노출 순위" />}>
                  <CompetitorExposureSection
                    keywords={session.keywords}
                    competitorDomains={session.competitorDomains}
                    fetchedAt={session.searchedAt}
                  />
                </Suspense>
                <Suspense fallback={<PanelSkeleton title="키워드 클러스터 & 콘텐츠 전략" />}>
                  <KeywordClusterSection
                    keywords={session.keywords}
                    competitorDomains={session.competitorDomains}
                    seed={session.keywords[0]}
                    fetchedAt={session.searchedAt}
                  />
                </Suspense>
              </>
            ),
          },
        ]}
      />
    </main>
  );
}
