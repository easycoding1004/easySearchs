import { extractBlogId } from "./blogProfileScraper";
import { createTtlCache } from "../utils/ttlCache";

// UNOFFICIAL — same category of exception as blogProfileScraper.ts (see its
// header comment): no Naver API exposes per-post comment counts or tags.
// This reads the blog's own public RSS feed to find its most recent post
// URLs, then scrapes each post's public mobile page for its comment count
// (fetchRecentEngagement) or tags (fetchPostTags, used by
// competitorKeywords.ts). "공감" (sympathy/likes) was investigated too but
// isn't present anywhere in the logged-out HTML — only "isReactionEnable"
// (a feature flag), no actual count — so it's not included here rather
// than being guessed at.
const RECENT_POST_SAMPLE = 5;
const REQUEST_TIMEOUT_MS = 8000;
const REQUEST_SPACING_MS = 400;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

// Same caching rationale as blogProfileScraper.ts — this is the heavier of
// the two scrapers (1 RSS fetch + up to RECENT_POST_SAMPLE post fetches per
// domain), so caching it matters even more for both latency and outbound
// request volume.
const ENGAGEMENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const engagementCache = createTtlCache<string, BlogEngagementStats>(ENGAGEMENT_CACHE_TTL_MS);
const tagsCache = createTtlCache<string, string[]>(ENGAGEMENT_CACHE_TTL_MS);

export interface BlogEngagementStats {
  postsScanned: number;
  totalComments: number;
  avgComments: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchRecentLogNos(blogId: string): Promise<string[]> {
  const xml = await fetchText(`https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`);
  if (!xml) return [];

  const logNos: string[] = [];
  const seen = new Set<string>();
  const guidPattern = /<guid>https:\/\/blog\.naver\.com\/[^/]+\/(\d+)<\/guid>/g;
  for (const match of xml.matchAll(guidPattern)) {
    const logNo = match[1];
    if (seen.has(logNo)) continue;
    seen.add(logNo);
    logNos.push(logNo);
    if (logNos.length >= RECENT_POST_SAMPLE) break;
  }
  return logNos;
}

// Naver embeds this post's data as an escaped JSON string inside a large
// inline <script> (not a clean `window.__X__ = {...}` assignment like the
// profile page), so a targeted regex is more robust here than trying to
// brace-match and JSON.parse the whole enclosing string.
function extractCommentCount(html: string): number | null {
  const match = html.match(/\\"commentCount\\":(\d+)/);
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

function extractPostId(link: string): { blogId: string; logNo: string } | null {
  const match = link.match(/blog\.naver\.com\/([a-zA-Z0-9_-]+)\/(\d+)/);
  return match ? { blogId: match[1], logNo: match[2] } : null;
}

// Used by competitorKeywords.ts to enrich "자주 쓰는 단어" beyond just
// title words — blog search results don't include tags at all, so each
// matched post has to be visited individually. Caller is responsible for
// capping how many posts get visited and pacing the requests.
export async function fetchPostTags(link: string): Promise<string[]> {
  const post = extractPostId(link);
  if (!post) return [];

  const cacheKey = `${post.blogId}/${post.logNo}`;
  const cached = tagsCache.get(cacheKey);
  if (cached) return cached;

  const html = await fetchText(`https://m.blog.naver.com/${encodeURIComponent(post.blogId)}/${post.logNo}`);
  if (!html) return [];

  const tags = extractTags(html);
  if (tags.length > 0) tagsCache.set(cacheKey, tags);
  return tags;
}

export async function fetchRecentEngagement(domain: string): Promise<BlogEngagementStats | null> {
  const blogId = extractBlogId(domain);
  if (!blogId) return null;

  const cached = engagementCache.get(blogId);
  if (cached) return cached;

  const logNos = await fetchRecentLogNos(blogId);
  if (logNos.length === 0) return null;

  let totalComments = 0;
  let postsScanned = 0;
  for (const logNo of logNos) {
    await sleep(REQUEST_SPACING_MS);
    const html = await fetchText(`https://m.blog.naver.com/${encodeURIComponent(blogId)}/${logNo}`);
    if (!html) continue;
    const commentCount = extractCommentCount(html);
    if (commentCount == null) continue;
    totalComments += commentCount;
    postsScanned += 1;
  }

  if (postsScanned === 0) return null;
  const result: BlogEngagementStats = {
    postsScanned,
    totalComments,
    avgComments: Math.round((totalComments / postsScanned) * 10) / 10,
  };
  engagementCache.set(blogId, result);
  return result;
}
