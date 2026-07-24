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

const MAX_DISPLAY = 100;
// The local (지역검색) search endpoint caps display at 5, unlike blog/cafe's 100.
const MAX_LOCAL_DISPLAY = 5;
const RATE_LIMIT_MAX_ATTEMPTS = 6;
const RATE_LIMIT_BASE_DELAY_MS = 1000;
// Naver's Open API rate limit turned out much stricter than typical (250ms
// spacing still triggered 429s) — pace every outgoing request (blog + cafe
// share the same limit) to at least this far apart instead of only
// reacting to 429s after the fact.
const MIN_REQUEST_INTERVAL_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;
async function throttle() {
  const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
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
async function naverSearch<T>(
  endpoint: string,
  query: string,
  options: { display?: number; sort?: string } = {}
): Promise<NaverSearchResult<T>> {
  const { display = MAX_DISPLAY, sort = "sim" } = options;
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

export async function searchBlog(
  query: string,
  options: { sort?: "sim" | "date" } = {}
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
