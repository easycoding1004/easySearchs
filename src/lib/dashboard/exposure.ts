import type { BlogSearchItem } from "../naver/openApiClient";

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

// Rank is 1-based position within the fetched result set; null means the
// competitor's domain didn't appear at all (checked against both the post
// link and the blogger's own homepage link).
export function findExposureRank(
  items: BlogSearchItem[],
  competitorDomain: string
): number | null {
  const target = normalizeDomain(competitorDomain);
  const index = items.findIndex(
    (item) =>
      item.link.toLowerCase().includes(target) ||
      item.bloggerlink.toLowerCase().includes(target)
  );
  return index === -1 ? null : index + 1;
}
