import { fetchKeywordStats } from "./client";
import { searchBlog } from "./openApiClient";
import type { NormalizedKeywordRow } from "./types";
import { countTermFrequency } from "../utils/tokenize";

// Naver's keywordstool accepts at most 5 comma-separated hint keywords per
// call — reuse that cap for the expansion batch too.
const MAX_EXPANSION_CANDIDATES = 5;
// Overshoot the candidate pool so there's still something left after
// filtering out the seed itself / already-known keywords (which otherwise
// dominate the top of the frequency list, since it's the term the search
// was for).
const CANDIDATE_POOL_SIZE = MAX_EXPANSION_CANDIDATES * 3;

function normalizeForDedupe(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

// Niche/local seed keywords often get few or no Naver-suggested related
// keywords back. Rather than guessing at generic modifiers, mine the words
// that actually show up in top blog post titles for the seed (official
// Blog Search API response — no scraping, no extra page fetches) and look
// up *those* words' real search-volume/competition data. Real market
// content, not fabricated numbers or a fixed guess-list.
export async function expandSparseKeywords(
  seed: string,
  existing: NormalizedKeywordRow[]
): Promise<NormalizedKeywordRow[]> {
  const known = new Set(existing.map((n) => normalizeForDedupe(n.relKeyword)));
  known.add(normalizeForDedupe(seed));

  let titles: string[];
  try {
    const { items } = await searchBlog(seed);
    titles = items.map((item) => item.title);
  } catch (err) {
    console.warn(
      `[expandSparseKeywords] blog search failed for seed "${seed}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }

  const frequentNouns = await countTermFrequency(titles, CANDIDATE_POOL_SIZE);
  const candidates = frequentNouns
    .map((t) => t.term)
    .filter((term) => !known.has(normalizeForDedupe(term)))
    .slice(0, MAX_EXPANSION_CANDIDATES);

  if (candidates.length === 0) return [];

  let expanded: NormalizedKeywordRow[];
  try {
    expanded = await fetchKeywordStats(candidates.join(","));
  } catch (err) {
    console.warn(
      `[expandSparseKeywords] hintKeywords lookup failed for seed "${seed}" (candidates: ${candidates.join(", ")}):`,
      err instanceof Error ? err.message : err
    );
    return [];
  }

  // fetchKeywordStats returns Naver's *entire* related-keyword tree for
  // each hint, not just that hint's own row — a popular candidate word
  // (e.g. a generic term that happened to show up in a title) can pull in
  // hundreds of unrelated suggestions. Keep only rows that are literally
  // one of our mined candidates.
  const candidateSet = new Set(candidates.map(normalizeForDedupe));
  const added: NormalizedKeywordRow[] = [];
  for (const row of expanded) {
    const key = normalizeForDedupe(row.relKeyword);
    if (!candidateSet.has(key)) continue;
    if (known.has(key)) continue;
    known.add(key);
    added.push(row);
  }
  return added;
}
