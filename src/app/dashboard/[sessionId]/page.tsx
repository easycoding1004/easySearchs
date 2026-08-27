import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBlogScoreSessionById } from "@/lib/notion/blogScoreSessions";
import { getRecordsForBlogScoreSession } from "@/lib/notion/blogScoreRecords";
import { getKeywordVolumes } from "@/lib/dashboard/keywordVolume";
import { getBlogPublishStatsForKeywords } from "@/lib/naver/blogPublishStats";
import { getMentionVolume } from "@/lib/dashboard/mentions";
import {
  getDashboardExposure,
  getDashboardLocalExposure,
  type LocalExposureEntry,
} from "@/lib/dashboard/dashboardExposure";
import { getCompetitorKeywordProfiles } from "@/lib/dashboard/competitorKeywords";
import { recommendTitleAndTags, sortByVolumeDesc, MAX_CLUSTER_NODES } from "@/lib/dashboard/keywordCluster";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { formatKstDateTime } from "@/lib/utils/formatDate";
import { NAVER_OPENAPI_CONCURRENCY } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { isPaidSubscriber } from "@/lib/notion/users";
import type { RadarScore } from "@/lib/dashboard/contentDiagnostics";
import type { BlogProfileStats } from "@/lib/naver/blogProfileScraper";

import KeywordVolumePanel from "@/components/dashboard/KeywordVolumePanel";
import MentionVolumePanel from "@/components/dashboard/MentionVolumePanel";
import CompetitorExposurePanel, { type ExposureDomainEntry } from "@/components/dashboard/CompetitorExposurePanel";
import LocalExposurePanel from "@/components/dashboard/LocalExposurePanel";
import KeywordClusterPanel from "@/components/dashboard/KeywordClusterPanel";
import BlogScorePanel from "@/components/dashboard/BlogScorePanel";
import PostAnalysisLive from "@/components/dashboard/PostAnalysisLive";
import PanelError from "@/components/dashboard/PanelError";
import PanelSkeleton from "@/components/dashboard/PanelSkeleton";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import ExportableImage from "@/components/dashboard/ExportableImage";
import EmbedBadgeCard from "@/components/dashboard/EmbedBadgeCard";
import BoardPromptLink from "@/components/BoardPromptLink";

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
  domains,
  fetchedAt,
}: {
  keywords: string[];
  domains: ExposureDomainEntry[];
  fetchedAt: string;
}) {
  const result = await settle(() =>
    getDashboardExposure(keywords, domains.map((d) => d.domain))
  );
  if (!result.ok) return <PanelError title="블로그 노출 순위" />;
  return <CompetitorExposurePanel results={result.value} domains={domains} fetchedAt={fetchedAt} />;
}

async function LocalExposureSection({
  keywords,
  entries,
  fetchedAt,
}: {
  keywords: string[];
  entries: LocalExposureEntry[];
  fetchedAt: string;
}) {
  const result = await settle(() => getDashboardLocalExposure(keywords, entries));
  if (!result.ok) return <PanelError title="지역·플레이스 진단" />;
  return <LocalExposurePanel results={result.value} entries={entries} fetchedAt={fetchedAt} />;
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

  const [session, viewer] = await Promise.all([getBlogScoreSessionById(sessionId), getCurrentUser()]);
  if (!session) notFound();
  // 2026-08 추가(토스페이먼츠 월 구독제) — AI 인사이트는 세션을 만든 사람이
  // 아니라 "지금 이 화면을 보고 있는 사람"의 구독 상태로 열람 가능 여부를
  // 판단함(공유 URL을 통한 무료 열람 방지, BlogScorePanel.tsx 참고).
  const insightLocked = !viewer || !isPaidSubscriber(viewer);

  const records = await getRecordsForBlogScoreSession(sessionId);

  const scores: RadarScore[] = records.map((r) => ({
    domain: r.domain,
    label: r.label,
    isMine: r.isMine,
    postCount: r.postVolume,
    exposureRank: r.exposureRank,
    engagement: r.engagement,
    reactionScore: r.reactionScore,
    shareScore: r.shareScore,
  }));

  const profileStats: Record<string, BlogProfileStats | null> = {};
  const avgRecentComments: Record<string, number | null> = {};
  const avgRecentReactions: Record<string, number | null> = {};
  const avgRecentShares: Record<string, number | null> = {};
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
    avgRecentReactions[r.domain] = r.avgRecentReactions;
    avgRecentShares[r.domain] = r.avgRecentShares;
    topTerms[r.domain] = r.topTerms;
  }

  const postAnalysisDomains = records.map((r) => ({
    domain: r.domain,
    label: r.label,
    isMine: r.isMine,
  }));

  const exposureDomains: ExposureDomainEntry[] = [
    ...(session.myBlogDomain ? [{ domain: session.myBlogDomain, isMine: true }] : []),
    ...session.competitorDomains.map((domain) => ({ domain, isMine: false })),
  ];

  const localExposureEntries: LocalExposureEntry[] = [
    ...(session.businessName
      ? [{ businessName: session.businessName, label: session.businessName, isMine: true }]
      : []),
    ...session.competitorBusinessNames.map((businessName) => ({
      businessName,
      label: businessName,
      isMine: false,
    })),
  ];

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
              <>
                <ExportableImage
                  fileName={`블로그지수-${session.myBlogDomain.replace(/[^a-zA-Z0-9가-힣.-]/g, "_")}`}
                  shareTitle={`${session.myBlogDomain} 블로그지수 - 이지서치`}
                >
                  <BlogScorePanel
                    scores={scores}
                    gaps={session.gaps}
                    fetchedAt={session.searchedAt}
                    profileStats={profileStats}
                    avgRecentComments={avgRecentComments}
                    avgRecentReactions={avgRecentReactions}
                    avgRecentShares={avgRecentShares}
                    topTerms={topTerms}
                    insightReport={session.insightReport}
                    insightLocked={insightLocked}
                  />
                </ExportableImage>
                <EmbedBadgeCard sessionId={sessionId} />
                <PostAnalysisLive domains={postAnalysisDomains} />
                <Suspense fallback={<PanelSkeleton title="지역·플레이스 진단" />}>
                  <LocalExposureSection
                    keywords={session.keywords}
                    entries={localExposureEntries}
                    fetchedAt={session.searchedAt}
                  />
                </Suspense>
              </>
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
                <Suspense fallback={<PanelSkeleton title="블로그 노출 순위" />}>
                  <CompetitorExposureSection
                    keywords={session.keywords}
                    domains={exposureDomains}
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

      <BoardPromptLink />
    </main>
  );
}
