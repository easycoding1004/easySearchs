import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { SESSION_PROPS } from "./schema";
import { createTtlCache } from "../utils/ttlCache";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export interface SiteStats {
  searchSessions: number;
  keywordsChecked: number;
  blogScoreSessions: number;
}

// 15분 TTL — 홈페이지 방문마다 Notion을 페이지네이션 조회하지 않도록. 정확한
// 실시간 값이 아니라 "대략 이 정도 쓰이고 있다"는 신뢰 지표라 이 정도 지연은
// 괜찮음.
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = createTtlCache<string, SiteStats>(CACHE_TTL_MS);

// Notion API에는 "개수만" 세는 엔드포인트가 없어서 페이지네이션하며 직접
// 센다 — 키워드 검색 결과 DB(행이 훨씬 많음)를 직접 세는 대신, 각 세션의
// "결과 개수" 필드를 합산해 같은 정보를 훨씬 적은 요청으로 얻는다.
async function countSessionsAndKeywords(dataSourceId: string): Promise<{ count: number; keywordSum: number }> {
  let count = 0;
  let keywordSum = 0;
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    count += res.results.length;
    for (const page of res.results.filter(isFullPage) as PageObjectResponse[]) {
      const prop = page.properties[SESSION_PROPS.resultCount];
      if (prop?.type === "number" && typeof prop.number === "number") {
        keywordSum += prop.number;
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return { count, keywordSum };
}

async function countRows(dataSourceId: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    count += res.results.length;
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return count;
}

export async function getSiteStats(): Promise<SiteStats> {
  const cached = cache.get("stats");
  if (cached) return cached;

  const [{ count: searchSessions, keywordSum: keywordsChecked }, blogScoreSessions] = await Promise.all([
    countSessionsAndKeywords(requireEnv("NOTION_SESSIONS_DB_ID")),
    countRows(requireEnv("NOTION_BLOG_SCORE_SESSIONS_DB_ID")),
  ]);

  const stats: SiteStats = { searchSessions, keywordsChecked, blogScoreSessions };
  cache.set("stats", stats);
  return stats;
}
