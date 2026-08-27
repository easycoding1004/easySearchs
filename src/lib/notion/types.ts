import type { CompetitionLevel } from "@/lib/naver/types";

export interface SearchSession {
  id: string;
  title: string;
  keyword: string;
  searchedAt: string;
  resultCount: number;
  authorId: string;
}

export type KeywordKind = "시드 키워드" | "연관 키워드" | "추론 키워드";

export interface KeywordRecord {
  id: string;
  keyword: string;
  kind: KeywordKind;
  pcCount: number;
  mobileCount: number;
  totalCount: number;
  compIdx: CompetitionLevel | null;
  avgAdDepth: number;
  totalBlogPosts: number | null;
  monthlyBlogPosts: number | null;
  blogSaturation: number | null;
  checkedAt: string;
}

export interface BlogScoreGap {
  axis: string;
  message: string;
}

export interface BlogScoreSession {
  id: string;
  title: string;
  myBlogDomain: string;
  competitorDomains: string[];
  keywords: string[];
  searchedAt: string;
  gaps: BlogScoreGap[];
  businessName: string | null;
  competitorBusinessNames: string[];
  insightReport: string | null;
  authorId: string;
}

export interface BlogScoreRecord {
  id: string;
  domain: string;
  label: string;
  isMine: boolean;
  compositeScore: number;
  postVolume: number; // "게시글 수" 축 점수(0-100) — 2026-07부터 실제 총 포스팅 수(postCount) 기준으로 재산정, 프로퍼티명은 유지
  exposureRank: number; // "검색 상위노출" 축 점수(0-100)
  engagement: number; // "댓글 수" 축 점수(0-100)
  reactionScore: number; // "공감 수" 축 점수(0-100)
  shareScore: number; // "공유수" 축 점수(0-100)
  category: string | null;
  todayVisitor: number | null;
  totalVisitor: number | null;
  subscriberCount: number | null;
  postCount: number | null;
  avgRecentComments: number | null;
  avgRecentReactions: number | null;
  avgRecentShares: number | null;
  topTerms: { term: string; count: number }[];
  checkedAt: string;
}

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  message: string;
  handled: boolean;
  receivedAt: string;
}
