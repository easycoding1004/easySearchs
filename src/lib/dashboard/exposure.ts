import type { BlogSearchItem, LocalSearchItem } from "../naver/openApiClient";

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

// 지역검색 API의 title은 blog.json과 마찬가지로 매칭된 부분에 <b> 태그를
// 감싸서 돌려준다(실측 확인) — 업체명 비교 전에 벗겨내야 함.
function stripHighlightTags(value: string): string {
  return value.replace(/<\/?b>/gi, "");
}

function normalizeBusinessName(value: string): string {
  return stripHighlightTags(value).replace(/\s+/g, "").toLowerCase();
}

// 블로그 노출순위(findExposureRank)와 같은 1-based 순위 규칙이지만, 지역검색
// 결과는 URL이 아니라 업체명(title)으로만 비교 가능함. 지점명이 붙는 경우
// (예: "이지카페 강남점")까지 감안해 양방향 부분일치로 매칭 — 정확히 같은
// 문자열이 아니어도 한쪽이 다른 쪽을 포함하면 같은 업체로 간주한다.
export function findLocalExposureRank(
  items: LocalSearchItem[],
  businessName: string
): number | null {
  const target = normalizeBusinessName(businessName);
  if (!target) return null;
  const index = items.findIndex((item) => {
    const title = normalizeBusinessName(item.title);
    return title.includes(target) || target.includes(title);
  });
  return index === -1 ? null : index + 1;
}
