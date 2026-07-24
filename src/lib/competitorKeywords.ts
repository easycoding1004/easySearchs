import { searchBlog } from "./naver/openApiClient";
import { normalizeDomain } from "./exposure";
import { countTermFrequency, type TermFrequency } from "./utils/tokenize";
import { mapWithConcurrency } from "./utils/concurrency";
import { NAVER_OPENAPI_CONCURRENCY } from "./constants";

const MAX_CLUSTER_KEYWORDS_FOR_COMPETITOR_SCAN = 8;
const TOP_TERMS_PER_COMPETITOR = 12;

export interface CompetitorKeywordProfile {
  domain: string;
  terms: TermFrequency[];
  postsSeen: number;
}

// For each of the cluster's top keywords, search blog once and collect the
// titles of any posts belonging to a tracked competitor domain, then run a
// simple word-frequency count over those titles per competitor — an
// approximation of "what this competitor talks about" built from public
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

  await mapWithConcurrency(scanKeywords, NAVER_OPENAPI_CONCURRENCY, async (keyword) => {
    const { items } = await searchBlog(keyword);
    for (const item of items) {
      const link = item.link.toLowerCase();
      const bloggerLink = item.bloggerlink.toLowerCase();
      for (const { original, normalized } of normalizedDomains) {
        if (link.includes(normalized) || bloggerLink.includes(normalized)) {
          titlesByDomain.get(original)!.push(item.title);
        }
      }
    }
  });

  return Promise.all(
    normalizedDomains.map(async ({ original }) => {
      const titles = titlesByDomain.get(original) ?? [];
      return {
        domain: original,
        terms: await countTermFrequency(titles, TOP_TERMS_PER_COMPETITOR),
        postsSeen: titles.length,
      };
    })
  );
}
