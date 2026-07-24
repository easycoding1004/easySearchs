export interface NaverKeywordRawRow {
  relKeyword: string;
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
  compIdx: string;
  plAvgDepth: number | string;
  [key: string]: unknown;
}

export interface NaverKeywordToolResponse {
  keywordList: NaverKeywordRawRow[];
}

export type CompetitionLevel = "낮음" | "중간" | "높음";

export interface NormalizedKeywordRow {
  relKeyword: string;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
  compIdx: CompetitionLevel | null;
  plAvgDepth: number;
}
