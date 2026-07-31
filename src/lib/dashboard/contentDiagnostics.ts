import { searchBlog, type BlogSearchItem } from "../naver/openApiClient";
import { normalizeDomain } from "./exposure";
import { countTermFrequency, type TermFrequency } from "../utils/tokenize";
import type { NormalizedKeywordRow, CompetitionLevel } from "../naver/types";

const MAX_SCAN_KEYWORDS = 8;
const TOP_TERMS_PER_DOMAIN = 12;

export interface DomainKeywordHit {
  keyword: string;
  matched: boolean;
  rank: number | null; // 1-based position in the scanned result set
  volume: number; // monthlyPcQcCnt + monthlyMobileQcCnt
  compIdx: CompetitionLevel | null;
}

export interface DomainContentProfile {
  domain: string;
  label: string;
  isMine: boolean;
  terms: TermFrequency[];
  hits: DomainKeywordHit[];
}

// 2026-07 전면 재설계 (사용자 요청): 예전엔 5개 축 전부가 "제공된 키워드로
// 검색했을 때 얼마나 잘 걸리는지"(키워드 커버리지/고검색량 공략도/저경쟁
// 공략도/콘텐츠 최신성) 중심이었음. 사용자가 검색 상위노출·게시글 수·댓글
// 수·공감 수·공유수로 완전히 바꿔달라고 요청했고, 그중 조회수·개설일·(공개
// 데이터가 있는지 실측 재확인해본) 공감·공유수 조사 결과 조회수/개설일은
// 여전히 못 찾았지만 공감·공유수는 실제로 공개 API/데이터로 확인됨
// (blogEngagementScraper.ts 헤더 주석 참고) — 그래서 이 5개로 확정:
// 검색 상위노출·게시글 수·댓글 수·공감 수·공유수. "검색 상위노출"만 키워드
// 종속적이라 여전히 getContentProfiles()가 필요하고, 나머지 4개는 키워드와
// 무관한 소스(블로그 프로필의 실제 포스팅 수 / 최근 게시물 댓글·공감·공유
// 평균)에서 옴.
export interface RadarScore {
  domain: string;
  label: string;
  isMine: boolean;
  exposureRank: number; // 검색 상위노출 — 0-100, 스캔한 키워드들의 평균 노출순위 기준
  postCount: number; // 게시글 수 — 0-100, 비교 대상 중 실제 총 포스팅 수 상대값
  engagement: number; // 댓글 수 — 0-100, 최근 게시물 평균 댓글수 상대값
  reactionScore: number; // 공감 수 — 0-100, 최근 게시물 평균 공감수 상대값
  shareScore: number; // 공유수 — 0-100, 최근 게시물 평균 공유수 상대값
}

export const RADAR_AXES: { key: keyof Omit<RadarScore, "domain" | "label" | "isMine">; label: string }[] = [
  { key: "exposureRank", label: "검색 상위노출" },
  { key: "postCount", label: "게시글 수" },
  { key: "engagement", label: "댓글 수" },
  { key: "reactionScore", label: "공감 수" },
  { key: "shareScore", label: "공유수" },
];

// 키워드 검색으로 각 블로그의 노출 순위·자주 쓰는 단어(제목 형태소)를 모음
// — RADAR_AXES 중 "검색 상위노출" 축과 화면의 "자주 쓰는 단어" 섹션이 여기서
// 나온 데이터를 씀. 나머지 4개 축은 키워드와 무관한 별도 소스에서 오므로
// applyPostCountScores/applyPostAnalysisScores가 나중에 채운다.
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

  const profiles = new Map<string, { hits: DomainKeywordHit[]; titles: string[] }>(
    domains.map((d) => [d.domain, { hits: [], titles: [] }])
  );

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
        profile.hits.push({ keyword: node.relKeyword, matched: false, rank: null, volume, compIdx: node.compIdx });
        continue;
      }

      const firstIndex = items.indexOf(matches[0]);
      profile.hits.push({
        keyword: node.relKeyword,
        matched: true,
        rank: firstIndex + 1,
        volume,
        compIdx: node.compIdx,
      });
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
        terms: await countTermFrequency(profile.titles, TOP_TERMS_PER_DOMAIN),
        hits: profile.hits,
      };
    })
  );
}

// "검색 상위노출" 축만 채운 초기 RadarScore를 만든다 — 나머지 4개 축은 0으로
// 시작해서 applyPostCountScores/applyPostAnalysisScores가 이어서 채움
// (예전 applyEngagementScores와 같은 레이어링 방식).
export function computeExposureScores(profiles: DomainContentProfile[]): RadarScore[] {
  return profiles.map((profile) => {
    const matchedHits = profile.hits.filter((h) => h.matched);
    const ranks = matchedHits.filter((h) => h.rank != null).map((h) => h.rank!);
    const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;

    return {
      domain: profile.domain,
      label: profile.label,
      isMine: profile.isMine,
      exposureRank: avgRank != null ? Math.round(100 * (1 - (avgRank - 1) / 99)) : 0,
      postCount: 0,
      engagement: 0,
      reactionScore: 0,
      shareScore: 0,
    };
  });
}

// "게시글 수" 축 — 키워드 매칭 개수가 아니라 블로그 프로필의 실제 총 포스팅
// 수(src/lib/naver/blogProfileScraper.ts의 postCount) 기준으로 비교 대상
// 중 상대값을 매긴다.
export function applyPostCountScores(
  scores: RadarScore[],
  postCounts: Map<string, number | null>
): RadarScore[] {
  const max = Math.max(1, ...scores.map((s) => postCounts.get(s.domain) ?? 0));
  return scores.map((s) => ({
    ...s,
    postCount: Math.round((100 * (postCounts.get(s.domain) ?? 0)) / max),
  }));
}

export interface PostAnalysisAverages {
  avgComments: number | null;
  avgReactions: number | null;
  avgShares: number | null;
}

// "댓글 수"·"공감 수"·"공유수" 축 — 셋 다 blogEngagementScraper.ts의
// fetchPostAnalysis() 결과(같은 최근 게시물 표본의 평균)에서 나오므로 한
// 함수에서 같이 채운다.
export function applyPostAnalysisScores(
  scores: RadarScore[],
  analysisByDomain: Map<string, PostAnalysisAverages | null>
): RadarScore[] {
  const maxComments = Math.max(1, ...scores.map((s) => analysisByDomain.get(s.domain)?.avgComments ?? 0));
  const maxReactions = Math.max(1, ...scores.map((s) => analysisByDomain.get(s.domain)?.avgReactions ?? 0));
  const maxShares = Math.max(1, ...scores.map((s) => analysisByDomain.get(s.domain)?.avgShares ?? 0));

  return scores.map((s) => {
    const a = analysisByDomain.get(s.domain);
    return {
      ...s,
      engagement: Math.round((100 * (a?.avgComments ?? 0)) / maxComments),
      reactionScore: Math.round((100 * (a?.avgReactions ?? 0)) / maxReactions),
      shareScore: Math.round((100 * (a?.avgShares ?? 0)) / maxShares),
    };
  });
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
  exposureRank: "글은 있지만 검색 노출 순위가 낮아요. 제목에 핵심 키워드를 더 앞쪽에 배치해보세요.",
  postCount: "게시물 수가 경쟁사보다 적어요. 관련 주제로 글을 더 발행해보세요.",
  engagement: "최근 게시물에 댓글이 적어요. 질문을 던지거나 답글을 다는 등 이웃과의 소통을 늘려보세요.",
  reactionScore: "최근 게시물의 공감 수가 적어요. 독자가 반응하기 쉬운 결론·요약을 글 끝에 넣어보세요.",
  shareScore: "최근 게시물이 잘 공유되지 않고 있어요. 체크리스트·정리글처럼 공유하고 싶은 내용을 더해보세요.",
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
