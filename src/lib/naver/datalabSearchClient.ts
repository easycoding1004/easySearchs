// Naver DataLab 검색어트렌드 (search trend) API — a *different* DataLab
// product from datalabClient.ts's shopping insight (different base path,
// no separate approval queue). Reuses the same Open API credentials as
// openApiClient.ts. Returns a relative 0-100 index per keyword group, NOT
// an absolute search count — never label this "검색량" next to the
// keywordstool API's absolute monthlyPcQcCnt/monthlyMobileQcCnt numbers.

import { throttle } from "./throttle";

const SEARCH_TREND_URL = "https://openapi.naver.com/v1/datalab/search";

export type TrendTimeUnit = "date" | "week" | "month";

export interface TrendKeywordGroup {
  groupName: string;
  keywords: string[];
}

interface TrendRequestBody {
  startDate: string;
  endDate: string;
  timeUnit: TrendTimeUnit;
  keywordGroups: TrendKeywordGroup[];
  device?: "" | "pc" | "mo";
  gender?: "" | "m" | "f";
  ages?: string[];
}

export interface TrendDataPoint {
  period: string;
  ratio: number;
}

export interface TrendResult {
  title: string;
  keywords: string[];
  data: TrendDataPoint[];
}

export interface TrendResponse {
  startDate: string;
  endDate: string;
  timeUnit: TrendTimeUnit;
  results: TrendResult[];
}

function requireHeaders() {
  const clientId = process.env.NAVER_OPENAPI_CLIENT_ID;
  const clientSecret = process.env.NAVER_OPENAPI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Naver Open API credentials: NAVER_OPENAPI_CLIENT_ID / NAVER_OPENAPI_CLIENT_SECRET"
    );
  }
  return {
    "X-Naver-Client-Id": clientId,
    "X-Naver-Client-Secret": clientSecret,
    "Content-Type": "application/json",
  };
}

export interface TrendDemographicFilter {
  device?: "pc" | "mo";
  gender?: "m" | "f";
  ages?: string[];
}

export async function fetchSearchTrend(
  keywordGroups: TrendKeywordGroup[],
  startDate: string,
  endDate: string,
  timeUnit: TrendTimeUnit,
  filter: TrendDemographicFilter = {}
): Promise<TrendResponse> {
  const body: TrendRequestBody = {
    startDate,
    endDate,
    timeUnit,
    keywordGroups,
    device: filter.device ?? "",
    gender: filter.gender ?? "",
    ages: filter.ages ?? [],
  };

  await throttle();
  const response = await fetch(SEARCH_TREND_URL, {
    method: "POST",
    headers: requireHeaders(),
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Naver DataLab search-trend API error (${response.status}): ${text}`);
  }
  return JSON.parse(text) as TrendResponse;
}
