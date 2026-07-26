import { GUIDE_ARTICLES } from "@/lib/guide/articles";

const SITE_URL = "https://ezzsearch.com";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Lets RSS readers / content-curation sites discover new guide articles
// without visiting /guide directly — a near-zero-cost distribution channel
// for the same content marketing this project already writes.
export async function GET() {
  const items = [...GUIDE_ARTICLES]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map(
      (article) => `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${SITE_URL}/guide/${article.slug}</link>
      <guid>${SITE_URL}/guide/${article.slug}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(article.description)}</description>
    </item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ezzsearch 가이드</title>
    <link>${SITE_URL}/guide</link>
    <description>네이버 키워드 검색량 조회 &amp; 블로그지수 — ezzsearch 콘텐츠 마케팅 가이드</description>
    <language>ko</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
