import type { MetadataRoute } from "next";

const BASE_URL = "https://ezzsearch.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /board/*는 다른 1회성 세션 페이지(/result, /dashboard)와 달리 진짜
      // 사용자가 쓴 콘텐츠라 색인 가치가 있음 — 의도적으로 차단 목록에서 제외.
      // /hotdeal은 2026-08 재설계로 노출 종료(HOTDEAL_ENABLED=false, 페이지도
      // 404) — 이미 색인된 URL의 재크롤링도 막아둠.
      disallow: ["/api/", "/admin", "/result/*", "/dashboard/*", "/hotdeal"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
