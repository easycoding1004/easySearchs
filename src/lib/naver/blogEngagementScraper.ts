import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";
import { extractBlogId } from "./blogProfileScraper";
import { createTtlCache } from "../utils/ttlCache";

// UNOFFICIAL — same category of exception as blogProfileScraper.ts (see its
// header comment): no Naver API exposes per-post comment/reaction/share
// counts or content stats. This reads the blog's own public RSS feed to find
// its most recent post URLs (fast-xml-parser, same library as
// lib/googleTrends/client.ts — CDATA fields parse straight through with
// ignoreAttributes:true), then scrapes each post's public mobile page.
//
// "공감"(reactions) — 2026-07 실측 재확인: an earlier investigation (see git
// history) concluded reactions were unobtainable because the static page
// only has "isReactionEnable" (a feature flag, no count). That was true for
// the static HTML, but incomplete — Naver's frontend fetches the actual
// count client-side from a separate public JSON API ("라이킷"/Likeit,
// https://blog.like.naver.com/v1/search/contents?q=BLOG[{blogId}_{logNo}]),
// confirmed working with a real post (no login required, just a Referer
// matching the post URL). Do not re-conclude "공감 unobtainable" without
// re-checking this endpoint first.
// "공유수"(shareCount) — also confirmed present, and simpler: it's already
// embedded in the post page's own escaped-JSON blob (scrap.shareCount),
// extracted the same way as commentCount below, no extra request needed.
const RECENT_POST_SAMPLE = 8;
const REQUEST_TIMEOUT_MS = 8000;
const REQUEST_SPACING_MS = 400;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

// Same caching rationale as blogProfileScraper.ts — this is by far the
// heaviest scraper in the project (1 RSS fetch + up to RECENT_POST_SAMPLE×2
// requests per domain: one post-page fetch + one Likeit call each), so
// caching matters even more for both latency and outbound request volume.
// Reused both by /api/blog-score (session-creation scoring) and by the
// live "게시글별 분석" section on the result page — a same-session revisit
// within the TTL hits this cache instead of re-scraping.
const ANALYSIS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const analysisCache = createTtlCache<string, BlogPostAnalysis>(ANALYSIS_CACHE_TTL_MS);
const tagsCache = createTtlCache<string, string[]>(ANALYSIS_CACHE_TTL_MS);

const rssParser = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === "item" });

export interface PostDetail {
  logNo: string;
  title: string;
  link: string;
  pubDate: string | null; // ISO 8601, RSS pubDate parsed
  category: string | null; // 메뉴주제 (RSS <category>)
  commentCount: number | null;
  reactionCount: number | null; // 공감
  shareCount: number | null; // 공유
  charCount: number | null; // 본문 글자수(공백 제외)
  imageCount: number | null;
  quoteCount: number | null; // 인용구 블록 수
  internalLinkCount: number | null; // 같은 블로그로 가는 링크
  externalLinkCount: number | null; // 그 외 링크
}

export interface BlogPostAnalysis {
  posts: PostDetail[];
  postsScanned: number;
  avgComments: number | null;
  avgReactions: number | null;
  avgShares: number | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string, referer?: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, ...(referer ? { Referer: referer } : {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface RssItem {
  logNo: string;
  title: string;
  link: string;
  pubDate: string | null;
  category: string | null;
}

async function fetchRecentRssItems(blogId: string): Promise<RssItem[]> {
  const xml = await fetchText(`https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`);
  if (!xml) return [];

  let parsed: unknown;
  try {
    parsed = rssParser.parse(xml);
  } catch {
    return [];
  }
  const rawItems = (parsed as { rss?: { channel?: { item?: unknown[] } } })?.rss?.channel?.item;
  if (!Array.isArray(rawItems)) return [];

  const seen = new Set<string>();
  const items: RssItem[] = [];
  for (const raw of rawItems as Record<string, unknown>[]) {
    const link = typeof raw.link === "string" ? raw.link : "";
    const match = link.match(/blog\.naver\.com\/[^/]+\/(\d+)/);
    if (!match) continue;
    const logNo = match[1];
    if (seen.has(logNo)) continue;
    seen.add(logNo);

    const pubDateRaw = typeof raw.pubDate === "string" ? new Date(raw.pubDate) : null;
    items.push({
      logNo,
      title: typeof raw.title === "string" ? raw.title : "",
      link: `https://blog.naver.com/${blogId}/${logNo}`,
      pubDate: pubDateRaw && !isNaN(pubDateRaw.getTime()) ? pubDateRaw.toISOString() : null,
      category: typeof raw.category === "string" ? raw.category : null,
    });
    if (items.length >= RECENT_POST_SAMPLE) break;
  }
  return items;
}

// Naver embeds this post's data as an escaped JSON string inside a large
// inline <script> (not a clean `window.__X__ = {...}` assignment like the
// profile page), so a targeted regex is more robust here than trying to
// brace-match and JSON.parse the whole enclosing string.
function extractCommentCount(html: string): number | null {
  const match = html.match(/\\"commentCount\\":(\d+)/);
  return match ? Number(match[1]) : null;
}

// Same embedded-escaped-JSON situation as commentCount — "공유"(share) count
// lives under the post's "scrap" object (실측 확인, 2026-07).
function extractShareCount(html: string): number | null {
  const match = html.match(/\\"shareCount\\":(\d+)/);
  return match ? Number(match[1]) : null;
}

// Same embedded-JSON-string situation as commentCount — tagNames is a
// single comma-joined string (Korean text as \uXXXX escapes, ASCII tags
// like "SW코딩자격증" mixed in literally), not a JSON array.
function extractTags(html: string): string[] {
  const match = html.match(/\\"tagNames\\":\\"((?:\\u[0-9a-fA-F]{4}|[A-Za-z0-9]|,)*)/);
  if (!match) return [];
  try {
    const decoded = JSON.parse(`"${match[1]}"`) as string;
    return decoded.split(",").map((t) => t.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

interface ContentStats {
  charCount: number | null;
  imageCount: number | null;
  quoteCount: number | null;
  internalLinkCount: number | null;
  externalLinkCount: number | null;
}

const EMPTY_CONTENT_STATS: ContentStats = {
  charCount: null,
  imageCount: null,
  quoteCount: null,
  internalLinkCount: null,
  externalLinkCount: null,
};

// SmartEditor renders the post body server-side as HTML with stable class
// names (se-main-container/se-text/se-quote/se-module-image, 실측 확인) —
// unlike commentCount/shareCount/공감, this isn't hidden behind a JS state
// blob, so a real DOM parser (cheerio) is far more reliable here than
// stacking more regexes on nested HTML.
function extractContentStats(html: string, blogId: string): ContentStats {
  const $ = cheerio.load(html);
  const main = $(".se-main-container").first();
  if (main.length === 0) return EMPTY_CONTENT_STATS;

  const charCount = main.text().replace(/\s+/g, "").length;
  const imageCount = main.find("img").length;
  const quoteCount = main.find(".se-quote").length;

  let internalLinkCount = 0;
  let externalLinkCount = 0;
  // se-text로 범위를 좁힌 이유: se-module-image 안의 <a>는 이미지 확대뷰용
  // 앵커라 저자가 실제로 넣은 하이퍼링크가 아님 — 포함하면 링크 수가 부풀려짐.
  main.find('.se-text a[href^="http"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.includes(`blog.naver.com/${blogId}`)) internalLinkCount++;
    else externalLinkCount++;
  });

  return { charCount, imageCount, quoteCount, internalLinkCount, externalLinkCount };
}

// "공감"(라이킷) 수는 정적 HTML 어디에도 없고(isReactionEnable 플래그뿐),
// 네이버 프론트엔드가 클라이언트에서 별도로 호출하는 공개 JSON API로만
// 얻을 수 있음(실측 확인, 2026-07) — 로그인 불필요, 게시글 URL과 일치하는
// Referer만 있으면 됨. q 파라미터 형식은 "BLOG[{blogId}_{logNo}]".
async function fetchReactionCount(blogId: string, logNo: string, postUrl: string): Promise<number | null> {
  try {
    const url = new URL("https://blog.like.naver.com/v1/search/contents");
    url.searchParams.set("q", `BLOG[${blogId}_${logNo}]`);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Referer: postUrl },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      contents?: { reactions?: { count?: unknown }[] }[];
    };
    const reactions = data.contents?.[0]?.reactions;
    if (!Array.isArray(reactions)) return 0;
    return reactions.reduce((sum, r) => sum + (typeof r.count === "number" ? r.count : 0), 0);
  } catch {
    return null;
  }
}

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

// Used by competitorKeywords.ts to enrich "자주 쓰는 단어" beyond just
// title words — blog search results don't include tags at all, so each
// matched post has to be visited individually. Caller is responsible for
// capping how many posts get visited and pacing the requests.
export async function fetchPostTags(link: string): Promise<string[]> {
  const match = link.match(/blog\.naver\.com\/([a-zA-Z0-9_-]+)\/(\d+)/);
  if (!match) return [];
  const [, blogId, logNo] = match;

  const cacheKey = `${blogId}/${logNo}`;
  const cached = tagsCache.get(cacheKey);
  if (cached) return cached;

  const html = await fetchText(`https://m.blog.naver.com/${encodeURIComponent(blogId)}/${logNo}`);
  if (!html) return [];

  const tags = extractTags(html);
  if (tags.length > 0) tagsCache.set(cacheKey, tags);
  return tags;
}

// 최근 게시물(RECENT_POST_SAMPLE개) 각각의 댓글·공감·공유·본문 구조 통계를
// 모아 반환 — /api/blog-score가 세션 생성 시 점수(댓글수/공감수/공유수 축)
// 계산에 쓰고, 결과 페이지의 "게시글별 분석" 섹션이 같은 캐시를 라이브로
// 재사용해 표로 보여줌(둘 다 이 함수 하나를 호출 — 중복 스크래핑 없음).
export async function fetchPostAnalysis(domain: string): Promise<BlogPostAnalysis | null> {
  const blogId = extractBlogId(domain);
  if (!blogId) return null;

  const cached = analysisCache.get(blogId);
  if (cached) return cached;

  const rssItems = await fetchRecentRssItems(blogId);
  if (rssItems.length === 0) return null;

  const posts: PostDetail[] = [];
  for (const item of rssItems) {
    await sleep(REQUEST_SPACING_MS);
    const html = await fetchText(`https://m.blog.naver.com/${blogId}/${item.logNo}`);
    const commentCount = html ? extractCommentCount(html) : null;
    const shareCount = html ? extractShareCount(html) : null;
    const contentStats = html ? extractContentStats(html, blogId) : EMPTY_CONTENT_STATS;

    await sleep(REQUEST_SPACING_MS);
    const reactionCount = await fetchReactionCount(blogId, item.logNo, item.link);

    posts.push({ ...item, commentCount, reactionCount, shareCount, ...contentStats });
  }

  if (posts.length === 0) return null;

  const result: BlogPostAnalysis = {
    posts,
    postsScanned: posts.length,
    avgComments: average(posts.map((p) => p.commentCount)),
    avgReactions: average(posts.map((p) => p.reactionCount)),
    avgShares: average(posts.map((p) => p.shareCount)),
  };
  analysisCache.set(blogId, result);
  return result;
}
