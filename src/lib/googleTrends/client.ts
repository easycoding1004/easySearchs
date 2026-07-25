import { XMLParser } from "fast-xml-parser";
import { createTtlCache } from "../utils/ttlCache";
import { mapWithConcurrency } from "../utils/concurrency";
import { fetchKeywordStats } from "../naver/client";
import { TRENDING_NAVER_MATCH_CONCURRENCY } from "../constants";

// 네이버는 실시간급상승검색어(실검)를 2021년에 완전히 폐지해 "지금 뜨는
// 검색어"를 구할 공식 경로가 없다. 구글 트렌드가 공개적으로 제공하는 한국
// 일간 트렌드 RSS로 대신한다 — 인증 불필요, Google이 의도적으로 배포하는
// 피드라 HTML 스크래핑보다 안전하다. 다만 이건 구글 사용자 기준 관심도지
// 네이버 자체 순위가 아니므로, 화면에 노출할 때는 항상 그 출처를 밝힐 것.
const RSS_URL = "https://trends.google.com/trending/rss?geo=KR";
const USER_AGENT = "ezzsearch.com (keyword research tool)";
const MAX_ITEMS = 20;
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2시간 — 구글이 이 정도 주기로 갱신함

export interface TrendingNewsItem {
  title: string;
  url: string;
  source: string;
}

export interface TrendingKeyword {
  title: string;
  approxTraffic: string; // 구글이 제공하는 대략적 관심도 문자열, 예: "1000+"
  startedAt: string; // ISO 8601
  newsItems: TrendingNewsItem[];
}

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === "item" || name === "ht:news_item",
});

interface RawNewsItem {
  "ht:news_item_title"?: string;
  "ht:news_item_url"?: string;
  "ht:news_item_source"?: string;
}

interface RawItem {
  title?: string;
  "ht:approx_traffic"?: string;
  pubDate?: string;
  "ht:news_item"?: RawNewsItem[];
}

function parseItem(raw: RawItem): TrendingKeyword | null {
  if (!raw.title) return null;
  const startedAt = raw.pubDate ? new Date(raw.pubDate) : null;

  return {
    title: raw.title,
    approxTraffic: raw["ht:approx_traffic"] ?? "",
    startedAt: startedAt && !isNaN(startedAt.getTime()) ? startedAt.toISOString() : "",
    newsItems: (raw["ht:news_item"] ?? [])
      .filter((n) => n["ht:news_item_title"] && n["ht:news_item_url"])
      .map((n) => ({
        title: n["ht:news_item_title"]!,
        url: n["ht:news_item_url"]!,
        source: n["ht:news_item_source"] ?? "",
      })),
  };
}

const cache = createTtlCache<string, TrendingKeyword[]>(CACHE_TTL_MS);

export async function fetchTrendingKeywordsKR(): Promise<TrendingKeyword[]> {
  const cached = cache.get("kr");
  if (cached) return cached;

  const response = await fetch(RSS_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Google Trends RSS error (${response.status})`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: RawItem[] } };
  };
  const rawItems = parsed.rss?.channel?.item ?? [];

  const items = rawItems
    .map(parseItem)
    .filter((item): item is TrendingKeyword => item !== null)
    .slice(0, MAX_ITEMS);

  cache.set("kr", items);
  return items;
}

export interface TrendingKeywordWithVolume extends TrendingKeyword {
  naverPcCount: number | null;
  naverMobileCount: number | null;
}

const enrichedCache = createTtlCache<string, TrendingKeywordWithVolume[]>(CACHE_TTL_MS);

// hintKeywords 파라미터는 공백이 섞이면 400 에러가 나므로(실측 확인) 공백을
// 제거한 문자열로 조회한다 — 네이버 자체 relKeyword도 공백 없이 반환됨.
export async function fetchTrendingKeywordsWithNaverVolume(): Promise<
  TrendingKeywordWithVolume[]
> {
  const cached = enrichedCache.get("kr");
  if (cached) return cached;

  const trending = await fetchTrendingKeywordsKR();

  const enriched = await mapWithConcurrency(
    trending,
    TRENDING_NAVER_MATCH_CONCURRENCY,
    async (item): Promise<TrendingKeywordWithVolume> => {
      const bareKeyword = item.title.replace(/\s+/g, "");
      try {
        const rows = await fetchKeywordStats(bareKeyword);
        const match = rows.find((r) => r.relKeyword === bareKeyword);
        return {
          ...item,
          naverPcCount: match?.monthlyPcQcCnt ?? null,
          naverMobileCount: match?.monthlyMobileQcCnt ?? null,
        };
      } catch (err) {
        console.error(`[googleTrends] Naver lookup failed for "${bareKeyword}":`, err);
        return { ...item, naverPcCount: null, naverMobileCount: null };
      }
    }
  );

  enrichedCache.set("kr", enriched);
  return enriched;
}
