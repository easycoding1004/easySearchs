import { searchBlog } from "../naver/openApiClient";
import { normalizeDomain } from "./exposure";
import { countTermFrequency, type TermFrequency } from "../utils/tokenize";
import { fetchPostTags } from "../naver/blogEngagementScraper";
import { mapWithConcurrency } from "../utils/concurrency";
import { NAVER_OPENAPI_CONCURRENCY } from "../constants";

const MAX_CLUSTER_KEYWORDS_FOR_COMPETITOR_SCAN = 8;
const TOP_TERMS_PER_COMPETITOR = 12;
// Blog search results have no tag data at all — each matched post has to
// be visited individually to read them, so this is capped per competitor
// to keep the extra request count bounded.
const MAX_TAG_SCAN_POSTS_PER_COMPETITOR = 5;
const TAG_FETCH_SPACING_MS = 400;

export interface CompetitorKeywordProfile {
  domain: string;
  terms: TermFrequency[];
  postsSeen: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Merges exact-match tag counts on top of the title-derived noun
// frequencies — tags are already atomic keywords (not sentences), so they
// don't need to go through morphological analysis like titles do.
function mergeTagCounts(titleTerms: TermFrequency[], tags: string[], topN: number): TermFrequency[] {
  const counts = new Map(titleTerms.map((t) => [t.term, t.count]));
  for (const tag of tags) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, count]) => ({ term, count }));
}

// For each of the cluster's top keywords, search blog once and collect the
// titles (+ post links) of any posts belonging to a tracked competitor
// domain. Runs a word-frequency count over those titles per competitor,
// then enriches it with tags scraped from a sample of each competitor's
// matched posts (see blogEngagementScraper.ts's fetchPostTags — Naver's
// blog search API doesn't return tags, only the post pages themselves do).
// An approximation of "what this competitor talks about" built from public
// search results, not a real content-analysis API.
export async function getCompetitorKeywordProfiles(
  clusterKeywords: string[],
  competitorDomains: string[]
): Promise<CompetitorKeywordProfile[]> {
  if (competitorDomains.length === 0) return [];

  const scanKeywords = clusterKeywords.slice(0, MAX_CLUSTER_KEYWORDS_FOR_COMPETITOR_SCAN);
  const normalizedDomains = competitorDomains.map((d) => ({
    original: d,
    normalized: normalizeDomain(d),
  }));

  const titlesByDomain = new Map<string, string[]>(
    normalizedDomains.map((d) => [d.original, []])
  );
  const linksByDomain = new Map<string, string[]>(
    normalizedDomains.map((d) => [d.original, []])
  );

  await mapWithConcurrency(scanKeywords, NAVER_OPENAPI_CONCURRENCY, async (keyword) => {
    const { items } = await searchBlog(keyword);
    for (const item of items) {
      const link = item.link.toLowerCase();
      const bloggerLink = item.bloggerlink.toLowerCase();
      for (const { original, normalized } of normalizedDomains) {
        if (link.includes(normalized) || bloggerLink.includes(normalized)) {
          titlesByDomain.get(original)!.push(item.title);
          linksByDomain.get(original)!.push(item.link);
        }
      }
    }
  });

  const tagsByDomain = new Map<string, string[]>();
  await mapWithConcurrency(normalizedDomains, NAVER_OPENAPI_CONCURRENCY, async ({ original }) => {
    const links = (linksByDomain.get(original) ?? []).slice(0, MAX_TAG_SCAN_POSTS_PER_COMPETITOR);
    const tags: string[] = [];
    for (const link of links) {
      await sleep(TAG_FETCH_SPACING_MS);
      tags.push(...(await fetchPostTags(link)));
    }
    tagsByDomain.set(original, tags);
  });

  return Promise.all(
    normalizedDomains.map(async ({ original }) => {
      const titles = titlesByDomain.get(original) ?? [];
      const titleTerms = await countTermFrequency(titles, TOP_TERMS_PER_COMPETITOR);
      const tags = tagsByDomain.get(original) ?? [];
      return {
        domain: original,
        terms: mergeTagCounts(titleTerms, tags, TOP_TERMS_PER_COMPETITOR),
        postsSeen: titles.length,
      };
    })
  );
}
