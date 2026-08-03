import type { MetadataRoute } from "next";

const BASE_URL = "https://ezzsearch.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /board/*는 다른 1회성 세션 페이지(/result, /dashboard)와 달리 진짜
      // 사용자가 쓴 콘텐츠라 색인 가치가 있음 — 의도적으로 차단 목록에서 제외.
      disallow: ["/api/", "/admin", "/result/*", "/dashboard/*"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
