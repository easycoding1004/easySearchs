export interface BlogSearchItem {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  bloggerlink: string;
  postdate: string;
}

export interface CafeSearchItem {
  title: string;
  link: string;
  description: string;
  cafename: string;
  cafeurl: string;
}

export interface LocalSearchItem {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

export interface NaverSearchResult<T> {
  items: T[];
  total: number;
}

interface NaverSearchResponse<T> {
  total: number;
  items: T[];
}

import { cache } from "react";
import { throttle } from "./throttle";

const MAX_DISPLAY = 100;
// The local (지역검색) search endpoint caps display at 5, unlike blog/cafe's 100.
const MAX_LOCAL_DISPLAY = 5;
const RATE_LIMIT_MAX_ATTEMPTS = 6;
const RATE_LIMIT_BASE_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireOpenApiHeaders() {
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
  };
}

// Shared GET + query-string + header-auth call shape used by every Naver
// Open API search endpoint (blog, cafe, local, ...). Each endpoint has its
// own valid `sort` values (blog/cafe: sim/date, local: random/comment), so
// callers pass the relevance-equivalent value explicitly rather than this
// function guessing one.
async function naverSearchImpl<T>(
  endpoint: string,
  query: string,
  display: number,
  sort: string
): Promise<NaverSearchResult<T>> {
  const url = new URL(`https://openapi.naver.com/v1/search/${endpoint}`);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", sort);

  for (let attempt = 0; attempt < RATE_LIMIT_MAX_ATTEMPTS; attempt++) {
    await throttle();
    const response = await fetch(url.toString(), {
      headers: requireOpenApiHeaders(),
    });

    if (response.status === 429 && attempt < RATE_LIMIT_MAX_ATTEMPTS - 1) {
      await sleep(RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Naver ${endpoint} search API error (${response.status}): ${body}`
      );
    }

    const data = (await response.json()) as NaverSearchResponse<T>;
    return { items: data.items, total: data.total };
  }

  throw new Error(`Naver ${endpoint} search API: rate limited after ${RATE_LIMIT_MAX_ATTEMPTS} attempts`);
}

// Different dashboard panels legitimately want the exact same search (same
// endpoint/query/display/sort) for overlapping keywords within one page
// render — e.g. mentions, competitor exposure, and the cluster panel's
// competitor scan all call searchBlog(keyword) with default params for the
// same tracked keywords. Without this, each of those panels burns its own
// throttled request re-asking Naver something another panel already asked
// in the same render. cache() (React's per-request memoization) is scoped
// to a single render/request, so it can't go stale across separate
// dashboard visits — it only dedupes work happening *right now*.
const cachedNaverSearch = cache(naverSearchImpl) as <T>(
  endpoint: string,
  query: string,
  display: number,
  sort: string
) => Promise<NaverSearchResult<T>>;

async function naverSearch<T>(
  endpoint: string,
  query: string,
  options: { display?: number; sort?: string } = {}
): Promise<NaverSearchResult<T>> {
  const { display = MAX_DISPLAY, sort = "sim" } = options;
  return cachedNaverSearch<T>(endpoint, query, display, sort);
}

export async function searchBlog(
  query: string,
  options: { sort?: "sim" | "date"; display?: number } = {}
): Promise<NaverSearchResult<BlogSearchItem>> {
  return naverSearch<BlogSearchItem>("blog.json", query, options);
}

export async function searchCafe(
  query: string
): Promise<NaverSearchResult<CafeSearchItem>> {
  return naverSearch<CafeSearchItem>("cafearticle.json", query);
}

export async function searchLocal(
  query: string
): Promise<NaverSearchResult<LocalSearchItem>> {
  return naverSearch<LocalSearchItem>("local.json", query, {
    display: MAX_LOCAL_DISPLAY,
    sort: "random",
  });
}
