import type { CompetitionLevel } from "@/lib/naver/types";

export interface SearchSession {
  id: string;
  title: string;
  keyword: string;
  searchedAt: string;
  resultCount: number;
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
}

export interface BlogScoreRecord {
  id: string;
  domain: string;
  label: string;
  isMine: boolean;
  compositeScore: number;
  postVolume: number;
  keywordCoverage: number;
  highVolumeCoverage: number;
  lowCompetitionCoverage: number;
  exposureRank: number;
  freshness: number;
  engagement: number;
  category: string | null;
  todayVisitor: number | null;
  totalVisitor: number | null;
  subscriberCount: number | null;
  postCount: number | null;
  avgRecentComments: number | null;
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
