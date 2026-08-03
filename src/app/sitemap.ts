import type { MetadataRoute } from "next";
import { GUIDE_ARTICLES } from "@/lib/guide/articles";
import { CATEGORIES } from "@/lib/naver/categoryTrends";

const BASE_URL = "https://ezzsearch.com";

// Only the evergreen landing pages — /result/[id] and /dashboard/[id] are
// ephemeral, one-off pages created per search (see robots.ts: noindex'd
// individually and disallowed here) and would just be thin/duplicate
// content to a crawler.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/dashboard`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/write`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // 개별 게시글까지 동적으로 열거하는 건 이번 범위 밖(§CLAUDE.md 16) — 목록
    // 페이지만 우선 추가.
    { url: `${BASE_URL}/board`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/trending`, lastModified: now, changeFrequency: "hourly", priority: 0.6 },
    { url: `${BASE_URL}/keywords`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    ...CATEGORIES.map((category) => ({
      url: `${BASE_URL}/keywords/${category.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    { url: `${BASE_URL}/guide`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    ...GUIDE_ARTICLES.map((article) => ({
      url: `${BASE_URL}/guide/${article.slug}`,
      lastModified: new Date(article.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
