import { searchBlog, type BlogSearchItem } from "../naver/openApiClient";
import { normalizeDomain } from "./exposure";
import { countTermFrequency, type TermFrequency } from "../utils/tokenize";
import { parseNaverPostDate } from "../utils/naverDate";
import type { NormalizedKeywordRow, CompetitionLevel } from "../naver/types";

const MAX_SCAN_KEYWORDS = 8;
const FRESHNESS_WINDOW_DAYS = 90;
const TOP_TERMS_PER_DOMAIN = 12;

export interface DomainKeywordHit {
  keyword: string;
  matched: boolean;
  rank: number | null; // 1-based position in the scanned result set
  volume: number; // monthlyPcQcCnt + monthlyMobileQcCnt
  compIdx: CompetitionLevel | null;
  latestPostDate: string | null; // YYYYMMDD, most recent matching post
}

export interface DomainContentProfile {
  domain: string;
  label: string;
  isMine: boolean;
  postsSeen: number;
  terms: TermFrequency[];
  hits: DomainKeywordHit[];
}

export interface RadarScore {
  domain: string;
  label: string;
  isMine: boolean;
  postVolume: number; // 0-100, relative to the max across compared domains
  keywordCoverage: number; // 0-100
  highVolumeCoverage: number; // 0-100, search-volume-weighted
  lowCompetitionCoverage: number; // 0-100
  exposureRank: number; // 0-100, higher = better average rank
  freshness: number; // 0-100
  engagement: number; // 0-100, relative to the max avg recent-post comment count across compared domains
}

export const RADAR_AXES: { key: keyof Omit<RadarScore, "domain" | "label" | "isMine">; label: string }[] = [
  { key: "postVolume", label: "콘텐츠량" },
  { key: "keywordCoverage", label: "키워드 커버리지" },
  { key: "highVolumeCoverage", label: "고검색량 공략도" },
  { key: "lowCompetitionCoverage", label: "저경쟁 공략도" },
  { key: "exposureRank", label: "평균 노출순위" },
  { key: "freshness", label: "콘텐츠 최신성" },
  { key: "engagement", label: "사용자 반응" },
];

// One blog search per scanned keyword, shared across every domain being
// compared (mine + competitors) — avoids N-per-domain API calls.
export async function getContentProfiles(
  clusterNodes: NormalizedKeywordRow[],
  myDomain: string | null,
  competitorDomains: string[]
): Promise<DomainContentProfile[]> {
  const scanNodes = clusterNodes.slice(0, MAX_SCAN_KEYWORDS);

  const domains: { domain: string; label: string; isMine: boolean }[] = [
    ...(myDomain ? [{ domain: myDomain, label: "내 블로그", isMine: true }] : []),
    ...competitorDomains.map((d) => ({ domain: d, label: d, isMine: false })),
  ];

  const profiles = new Map<
    string,
    { hits: DomainKeywordHit[]; titles: string[]; postsSeen: number }
  >(domains.map((d) => [d.domain, { hits: [], titles: [], postsSeen: 0 }]));

  for (const node of scanNodes) {
    const volume = node.monthlyPcQcCnt + node.monthlyMobileQcCnt;
    let items: BlogSearchItem[] = [];
    try {
      items = (await searchBlog(node.relKeyword)).items;
    } catch {
      // A single failed keyword shouldn't take down the whole scan — every
      // domain just records a non-match for this keyword.
    }

    for (const { domain } of domains) {
      const target = normalizeDomain(domain);
      const matches = items.filter(
        (item) =>
          item.link.toLowerCase().includes(target) ||
          item.bloggerlink.toLowerCase().includes(target)
      );
      const profile = profiles.get(domain)!;

      if (matches.length === 0) {
        profile.hits.push({
          keyword: node.relKeyword,
          matched: false,
          rank: null,
          volume,
          compIdx: node.compIdx,
          latestPostDate: null,
        });
        continue;
      }

      const firstIndex = items.indexOf(matches[0]);
      const latestPostDate = matches
        .map((m) => m.postdate)
        .sort()
        .at(-1) ?? null;

      profile.hits.push({
        keyword: node.relKeyword,
        matched: true,
        rank: firstIndex + 1,
        volume,
        compIdx: node.compIdx,
        latestPostDate,
      });
      profile.postsSeen += matches.length;
      profile.titles.push(...matches.map((m) => m.title));
    }
  }

  return Promise.all(
    domains.map(async ({ domain, label, isMine }) => {
      const profile = profiles.get(domain)!;
      return {
        domain,
        label,
        isMine,
        postsSeen: profile.postsSeen,
        terms: await countTermFrequency(profile.titles, TOP_TERMS_PER_DOMAIN),
        hits: profile.hits,
      };
    })
  );
}

export function computeRadarScores(profiles: DomainContentProfile[]): RadarScore[] {
  const maxPosts = Math.max(1, ...profiles.map((p) => p.postsSeen));
  const now = Date.now();

  return profiles.map((profile) => {
    const hits = profile.hits;
    const matchedHits = hits.filter((h) => h.matched);
    const totalVolume = hits.reduce((sum, h) => sum + h.volume, 0);
    const matchedVolume = matchedHits.reduce((sum, h) => sum + h.volume, 0);
    const lowCompHits = hits.filter((h) => h.compIdx === "낮음");
    const lowCompMatched = lowCompHits.filter((h) => h.matched);

    const ranks = matchedHits.filter((h) => h.rank != null).map((h) => h.rank!);
    const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;

    const freshCount = matchedHits.filter((h) => {
      if (!h.latestPostDate) return false;
      const date = parseNaverPostDate(h.latestPostDate);
      if (!date) return false;
      const ageDays = (now - date.getTime()) / (1000 * 60 * 60 * 24);
      return ageDays <= FRESHNESS_WINDOW_DAYS;
    }).length;

    return {
      domain: profile.domain,
      label: profile.label,
      isMine: profile.isMine,
      postVolume: Math.round((100 * profile.postsSeen) / maxPosts),
      keywordCoverage: hits.length
        ? Math.round((100 * matchedHits.length) / hits.length)
        : 0,
      highVolumeCoverage: totalVolume > 0 ? Math.round((100 * matchedVolume) / totalVolume) : 0,
      lowCompetitionCoverage: lowCompHits.length
        ? Math.round((100 * lowCompMatched.length) / lowCompHits.length)
        : 0,
      exposureRank: avgRank != null ? Math.round(100 * (1 - (avgRank - 1) / 99)) : 0,
      freshness: matchedHits.length ? Math.round((100 * freshCount) / matchedHits.length) : 0,
      // Filled in separately by applyEngagementScores() — computing it here
      // would require this function to know about recent-post comment
      // scraping, which is a different data source (blog RSS + post pages,
      // not the keyword-search hits this function scans).
      engagement: 0,
    };
  });
}

// Layers in the "사용자 반응" axis after computeRadarScores(), since it comes
// from a separate data source (recent-post comment counts, see
// naver/blogEngagementScraper.ts) rather than the keyword-search hits every
// other axis is built from.
export function applyEngagementScores(
  scores: RadarScore[],
  avgRecentComments: Map<string, number | null>
): RadarScore[] {
  const max = Math.max(1, ...scores.map((s) => avgRecentComments.get(s.domain) ?? 0));
  return scores.map((s) => ({
    ...s,
    engagement: Math.round((100 * (avgRecentComments.get(s.domain) ?? 0)) / max),
  }));
}

export function compositeScore(score: RadarScore): number {
  const values = RADAR_AXES.map(({ key }) => score[key]);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export interface GapMessage {
  axis: string;
  message: string;
}

const GAP_COPY: Record<string, string> = {
  postVolume: "게시물 수가 경쟁사보다 적어요. 관련 주제로 글을 더 발행해보세요.",
  keywordCoverage: "다루지 않은 연관 키워드가 많아요. 클러스터의 나머지 키워드로 글감을 확장해보세요.",
  highVolumeCoverage: "검색량이 높은 키워드를 아직 다루지 않았어요. 이런 키워드부터 글을 써보면 좋아요.",
  lowCompetitionCoverage: "상대적으로 경쟁이 낮은 키워드도 아직 안 다뤘어요. 빠르게 순위 잡기 좋은 기회예요.",
  exposureRank: "글은 있지만 검색 노출 순위가 낮아요. 제목에 핵심 키워드를 더 앞쪽에 배치해보세요.",
  freshness: "관련 글이 오래됐어요. 최신 정보로 업데이트하거나 새 글을 발행해보세요.",
  engagement: "최근 게시물에 댓글이 적어요. 질문을 던지거나 답글을 다는 등 이웃과의 소통을 늘려보세요.",
};

const GAP_THRESHOLD = 40;
const GAP_MARGIN = 15;

// Surfaces up to 3 axes where "mine" is both below a floor and meaningfully
// behind the best competitor — a simple rule, not a statistical model.
export function buildGapMessages(scores: RadarScore[]): GapMessage[] {
  const mine = scores.find((s) => s.isMine);
  const competitors = scores.filter((s) => !s.isMine);
  if (!mine || competitors.length === 0) return [];

  const gaps = RADAR_AXES.map(({ key, label }) => {
    const mineValue = mine[key];
    const bestCompetitor = Math.max(...competitors.map((c) => c[key]));
    return { key, label, mineValue, gap: bestCompetitor - mineValue };
  })
    .filter((g) => g.mineValue < GAP_THRESHOLD && g.gap >= GAP_MARGIN)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  return gaps.map((g) => ({ axis: g.label, message: GAP_COPY[g.key] }));
}
