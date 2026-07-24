import type { MetadataRoute } from "next";
import { GUIDE_ARTICLES } from "@/lib/guideArticles";

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
