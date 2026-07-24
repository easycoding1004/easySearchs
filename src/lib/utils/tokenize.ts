import { Garu } from "garu-ko";

// Real Korean morphological analysis (garu-ko, WASM, no native compile) —
// extracts nouns (NNG/NNP) instead of naively splitting on whitespace, so
// "이지코딩교습소를" no longer counts as one garbage token when the
// meaningful part is just "이지코딩교습소". The WASM model is ~1MB and
// loaded once per server process (verified against real blog titles before
// wiring this in — see conversation history, not a script left in repo).
let garuPromise: ReturnType<typeof Garu.load> | null = null;
function getGaru() {
  if (!garuPromise) garuPromise = Garu.load();
  return garuPromise;
}

const MIN_NOUN_LENGTH = 2;

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

export interface TermFrequency {
  term: string;
  count: number;
}

export async function countTermFrequency(
  texts: string[],
  topN: number
): Promise<TermFrequency[]> {
  const garu = await getGaru();
  const counts = new Map<string, number>();

  for (const text of texts) {
    for (const noun of garu.nouns(stripHtml(text))) {
      if (noun.length < MIN_NOUN_LENGTH) continue;
      counts.set(noun, (counts.get(noun) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, count]) => ({ term, count }));
}
