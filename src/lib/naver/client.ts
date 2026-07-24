import { generateSignature, getTimestamp } from "./sign";
import type {
  CompetitionLevel,
  NaverKeywordRawRow,
  NaverKeywordToolResponse,
  NormalizedKeywordRow,
} from "./types";

const NAVER_API_HOST = "https://api.naver.com";
const KEYWORD_TOOL_URI = "/keywordstool";

const VALID_COMPETITION_LEVELS: CompetitionLevel[] = ["낮음", "중간", "높음"];

function normalizeCount(value: number | string): number {
  if (typeof value === "number") return value;
  if (value.includes("<")) return 0;
  return Number(value);
}

function normalizeCompIdx(value: string): CompetitionLevel | null {
  return VALID_COMPETITION_LEVELS.includes(value as CompetitionLevel)
    ? (value as CompetitionLevel)
    : null;
}

export function normalizeRow(raw: NaverKeywordRawRow): NormalizedKeywordRow {
  return {
    relKeyword: raw.relKeyword,
    monthlyPcQcCnt: normalizeCount(raw.monthlyPcQcCnt),
    monthlyMobileQcCnt: normalizeCount(raw.monthlyMobileQcCnt),
    compIdx: normalizeCompIdx(raw.compIdx),
    plAvgDepth: normalizeCount(raw.plAvgDepth),
  };
}

export async function fetchKeywordStats(
  hintKeywords: string
): Promise<NormalizedKeywordRow[]> {
  const apiKey = process.env.NAVER_API_KEY;
  const secretKey = process.env.NAVER_SECRET_KEY;
  const customerId = process.env.NAVER_CUSTOMER_ID;

  if (!apiKey || !secretKey || !customerId) {
    throw new Error(
      "Missing Naver API credentials: NAVER_API_KEY / NAVER_SECRET_KEY / NAVER_CUSTOMER_ID"
    );
  }

  const method = "GET";
  const timestamp = getTimestamp();
  const signature = generateSignature(
    timestamp,
    method,
    KEYWORD_TOOL_URI,
    secretKey
  );

  const url = new URL(NAVER_API_HOST + KEYWORD_TOOL_URI);
  url.searchParams.set("hintKeywords", hintKeywords);
  url.searchParams.set("showDetail", "1");

  const response = await fetch(url.toString(), {
    method,
    headers: {
      "X-Timestamp": timestamp,
      "X-API-KEY": apiKey,
      "X-Customer": customerId,
      "X-Signature": signature,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Naver keyword tool API error (${response.status}): ${body}`
    );
  }

  const data = (await response.json()) as NaverKeywordToolResponse;
  return data.keywordList.map(normalizeRow);
}
