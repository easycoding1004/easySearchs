import { normalizeDomain } from "../dashboard/exposure";
import { createTtlCache } from "../utils/ttlCache";

// UNOFFICIAL — scrapes m.blog.naver.com's embedded React state (not a
// documented Naver API). Naver has no public API for a blog's own profile
// stats (category, neighbor count, visitor count, post count). This is a
// deliberate, explicit exception to this project's "official API only"
// rule, made after discussing the tradeoffs with the user: read-only,
// unauthenticated, single request per domain, cached for hours. Expect it
// to break if Naver changes the mobile blog page's markup/state shape —
// every field is optional and defaults to null rather than throwing.
const REQUEST_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

// Same domain gets searched repeatedly across visitors (e.g. a well-known
// local competitor everyone compares against) — caching cuts both latency
// and outbound request volume against Naver's page (see blog-scraping IP
// rate-limit risk discussed with the user). Only successful fetches are
// cached; a transient failure should be retried on the next request, not
// frozen as "private" for the whole TTL window.
const PROFILE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const profileCache = createTtlCache<string, BlogProfileStats>(PROFILE_CACHE_TTL_MS);

export interface BlogProfileStats {
  blogId: string;
  category: string | null;
  subscriberCount: number | null; // 이웃 수
  todayVisitorCount: number | null; // 최근(오늘) 방문자
  totalVisitorCount: number | null; // 총 방문자
  postCount: number | null; // 총 포스팅 수
}

export function extractBlogId(domain: string): string | null {
  const normalized = normalizeDomain(domain);
  const match = normalized.match(/blog\.naver\.com\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]+$/.test(normalized)) return normalized;
  return null;
}

// String-aware brace matching — a plain regex/indexOf can't tell a "}" in
// JSON structure apart from a "}" inside a free-text field (e.g. the
// blog's self-written introduction), so this walks the string tracking
// whether we're inside a quoted string.
function extractWindowAssignment(html: string, varName: string): unknown | null {
  const marker = `window.${varName} = `;
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const jsonStart = start + marker.length;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;

  try {
    return JSON.parse(html.slice(jsonStart, end));
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function fetchBlogProfileStats(
  domain: string
): Promise<BlogProfileStats | null> {
  const blogId = extractBlogId(domain);
  if (!blogId) return null;

  const cached = profileCache.get(blogId);
  if (cached) return cached;

  let html: string;
  try {
    const response = await fetch(`https://m.blog.naver.com/${encodeURIComponent(blogId)}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    html = await response.text();
  } catch {
    return null;
  }

  const state = extractWindowAssignment(html, "__INITIAL_STATE__") as
    | {
        blogHome?: {
          blogHomeInfo?: Record<string, { data?: Record<string, unknown> }>;
          blogContentsCount?: Record<string, { data?: Record<string, unknown> }>;
        };
      }
    | null;
  if (!state) return null;

  const info = state.blogHome?.blogHomeInfo?.[blogId]?.data;
  const contents = state.blogHome?.blogContentsCount?.[blogId]?.data;
  if (!info && !contents) return null;

  const result: BlogProfileStats = {
    blogId,
    category: stringOrNull(info?.blogDirectoryName),
    subscriberCount: numberOrNull(info?.subscriberCount),
    todayVisitorCount: numberOrNull(info?.dayVisitorCount),
    totalVisitorCount: numberOrNull(info?.totalVisitorCount),
    postCount: numberOrNull(contents?.postCount),
  };
  profileCache.set(blogId, result);
  return result;
}
