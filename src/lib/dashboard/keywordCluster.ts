import type { NormalizedKeywordRow } from "@/lib/naver/types";

// Cap on how many keyword nodes the mind-map renders — keeps it readable
// even when a full 30-keyword blog-score request comes back with volume
// data for every one of them.
export const MAX_CLUSTER_NODES = 36;

const TITLE_RECOMMEND_COUNT = 5;
const TAG_RECOMMEND_COUNT = 10;

function totalVolume(row: NormalizedKeywordRow): number {
  return row.monthlyPcQcCnt + row.monthlyMobileQcCnt;
}

export interface TitleTagRecommendation {
  titleKeywords: NormalizedKeywordRow[];
  tagKeywords: NormalizedKeywordRow[];
}

const COMPETITION_RANK: Record<string, number> = { 낮음: 0, 중간: 1, 높음: 2 };

// Rule-based, not AI: high volume + low competition keywords make the best
// title candidates (best ROI — the "제목" carries the most SEO weight and
// competing on an easy term maximizes the chance of ranking). The next tier
// by volume is offered as tag candidates — broader net, lower priority.
export function recommendTitleAndTags(
  nodes: NormalizedKeywordRow[]
): TitleTagRecommendation {
  const ranked = [...nodes].sort((a, b) => {
    const compDiff =
      (COMPETITION_RANK[a.compIdx ?? "높음"] ?? 2) -
      (COMPETITION_RANK[b.compIdx ?? "높음"] ?? 2);
    if (compDiff !== 0) return compDiff;
    return totalVolume(b) - totalVolume(a);
  });

  return {
    titleKeywords: ranked.slice(0, TITLE_RECOMMEND_COUNT),
    tagKeywords: ranked.slice(TITLE_RECOMMEND_COUNT, TITLE_RECOMMEND_COUNT + TAG_RECOMMEND_COUNT),
  };
}

export function sortByVolumeDesc(nodes: NormalizedKeywordRow[]): NormalizedKeywordRow[] {
  return [...nodes].sort((a, b) => totalVolume(b) - totalVolume(a));
}
