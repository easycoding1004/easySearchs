import type { RadarScore, GapMessage } from "./contentDiagnostics";
import type { BlogProfileStats } from "./naver/blogProfileScraper";
import type { NormalizedKeywordRow } from "./naver/types";
import type { TitleTagRecommendation } from "./keywordCluster";
import type { CompetitorKeywordProfile } from "./competitorKeywords";

// 실제 사용자 데이터가 아니라, /dashboard 방문 시 "결과가 이렇게 나와요"를
// 보여주기 위한 고정 예시 데이터 — 도메인도 일부러 가상의 이름을 씀. 실제
// BlogScorePanel/KeywordClusterPanel 컴포넌트를 그대로 재사용하므로, 두
// 컴포넌트의 디자인이 바뀌면 이 예시도 자동으로 같이 바뀐다.

const MY_DOMAIN = "blog.naver.com/my_cafe_blog";
const COMPETITOR_DOMAIN = "blog.naver.com/competitor_cafe_blog";

export const SAMPLE_FETCHED_AT = "2026-07-20T09:00:00.000Z";

export const SAMPLE_SCORES: RadarScore[] = [
  {
    domain: MY_DOMAIN,
    label: "내 블로그",
    isMine: true,
    postVolume: 68,
    keywordCoverage: 72,
    highVolumeCoverage: 55,
    lowCompetitionCoverage: 80,
    exposureRank: 60,
    freshness: 75,
    engagement: 45,
  },
  {
    domain: COMPETITOR_DOMAIN,
    label: COMPETITOR_DOMAIN,
    isMine: false,
    postVolume: 85,
    keywordCoverage: 60,
    highVolumeCoverage: 70,
    lowCompetitionCoverage: 50,
    exposureRank: 78,
    freshness: 90,
    engagement: 65,
  },
];

export const SAMPLE_GAPS: GapMessage[] = [
  {
    axis: "사용자 반응",
    message: "최근 게시물에 댓글이 적어요. 질문을 던지거나 답글을 다는 등 이웃과의 소통을 늘려보세요.",
  },
  {
    axis: "고검색량 공략도",
    message: "검색량이 높은 키워드를 아직 다루지 않았어요. 이런 키워드부터 글을 써보면 좋아요.",
  },
];

export const SAMPLE_PROFILE_STATS: Record<string, BlogProfileStats | null> = {
  [MY_DOMAIN]: {
    blogId: "my_cafe_blog",
    category: "카페·디저트",
    subscriberCount: 320,
    todayVisitorCount: 45,
    totalVisitorCount: 28500,
    postCount: 210,
  },
  [COMPETITOR_DOMAIN]: {
    blogId: "competitor_cafe_blog",
    category: "카페·디저트",
    subscriberCount: 540,
    todayVisitorCount: 90,
    totalVisitorCount: 61200,
    postCount: 340,
  },
};

export const SAMPLE_AVG_RECENT_COMMENTS: Record<string, number | null> = {
  [MY_DOMAIN]: 1.2,
  [COMPETITOR_DOMAIN]: 3.4,
};

export const SAMPLE_TOP_TERMS: Record<string, { term: string; count: number }[]> = {
  [MY_DOMAIN]: [
    { term: "카페", count: 8 },
    { term: "디저트", count: 6 },
    { term: "신메뉴", count: 4 },
    { term: "인테리어", count: 3 },
  ],
  [COMPETITOR_DOMAIN]: [
    { term: "카페", count: 10 },
    { term: "브런치", count: 7 },
    { term: "베이커리", count: 5 },
    { term: "동네카페", count: 4 },
  ],
};

export const SAMPLE_SEED = "동네카페";

export const SAMPLE_NODES: NormalizedKeywordRow[] = [
  { relKeyword: "동네카페", monthlyPcQcCnt: 1200, monthlyMobileQcCnt: 8400, compIdx: "높음", plAvgDepth: 10 },
  { relKeyword: "카페추천", monthlyPcQcCnt: 2400, monthlyMobileQcCnt: 15600, compIdx: "높음", plAvgDepth: 10 },
  { relKeyword: "브런치카페", monthlyPcQcCnt: 900, monthlyMobileQcCnt: 6200, compIdx: "중간", plAvgDepth: 8 },
  { relKeyword: "디저트카페", monthlyPcQcCnt: 700, monthlyMobileQcCnt: 5100, compIdx: "중간", plAvgDepth: 7 },
  { relKeyword: "인스타감성카페", monthlyPcQcCnt: 500, monthlyMobileQcCnt: 4300, compIdx: "낮음", plAvgDepth: 3 },
  { relKeyword: "애견동반카페", monthlyPcQcCnt: 300, monthlyMobileQcCnt: 2900, compIdx: "낮음", plAvgDepth: 2 },
  { relKeyword: "24시카페", monthlyPcQcCnt: 400, monthlyMobileQcCnt: 2100, compIdx: "중간", plAvgDepth: 5 },
  { relKeyword: "스터디카페", monthlyPcQcCnt: 1800, monthlyMobileQcCnt: 9700, compIdx: "높음", plAvgDepth: 10 },
];

export const SAMPLE_RECOMMENDATION: TitleTagRecommendation = {
  titleKeywords: [SAMPLE_NODES[4], SAMPLE_NODES[5], SAMPLE_NODES[3], SAMPLE_NODES[2], SAMPLE_NODES[6]],
  tagKeywords: [SAMPLE_NODES[0], SAMPLE_NODES[1], SAMPLE_NODES[7]],
};

export const SAMPLE_COMPETITOR_PROFILES: CompetitorKeywordProfile[] = [
  {
    domain: COMPETITOR_DOMAIN,
    postsSeen: 12,
    terms: [
      { term: "카페", count: 10 },
      { term: "브런치", count: 7 },
      { term: "베이커리", count: 5 },
      { term: "동네카페", count: 4 },
      { term: "디저트", count: 3 },
    ],
  },
];
