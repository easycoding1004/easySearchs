import type { MetadataRoute } from "next";
import { GUIDE_ARTICLES } from "@/lib/guide/articles";
import { CATEGORIES } from "@/lib/naver/categoryTrends";
import { getKeywordDirectory } from "@/lib/notion/keywordSnapshots";
import { GROUP_SLUGS } from "@/lib/blogType/quizData";

const BASE_URL = "https://ezzsearch.com";

// 키워드 사전 항목이 스냅샷 DB에 계속 추가되므로 sitemap을 빌드 시점에
// 얼리지 않고 요청 시 생성 — 스캔 비용은 keywordSnapshots.ts의 1시간 캐시가
// 흡수함(상주형 서버 전제, §CLAUDE.md 11).
export const dynamic = "force-dynamic";

// Only the evergreen landing pages — /result/[id] and /dashboard/[id] are
// ephemeral, one-off pages created per search (see robots.ts: noindex'd
// individually and disallowed here) and would just be thin/duplicate
// content to a crawler.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 키워드 사전(2026-08 유입 전략) — 스냅샷이 있는 키워드 전부를 등재해
  // 크롤러가 개별 페이지를 발견하게 함. 스캔 자체는 keywordSnapshots.ts의
  // 1시간 캐시가 흡수하고, 실패해도 sitemap 전체가 깨지지 않게 빈 배열 폴백.
  const keywordEntries = await getKeywordDirectory()
    .then((directory) =>
      directory.map((entry) => ({
        url: `${BASE_URL}/keyword/${encodeURIComponent(entry.keyword)}`,
        lastModified: new Date(entry.latestDate),
        changeFrequency: "weekly" as const,
        priority: 0.4,
      }))
    )
    .catch(() => []);

  return [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/dashboard`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/write`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // 개별 게시글까지 동적으로 열거하는 건 이번 범위 밖(§CLAUDE.md 16) — 목록
    // 페이지만 우선 추가.
    // 2026-08 재설계 — 키워드 검색량 조회가 홈 Hero에서 /search로 이동함.
    { url: `${BASE_URL}/search`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/board`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/policy-board`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    // /hotdeal은 2026-08 재설계로 노출 종료(HOTDEAL_ENABLED=false) — 목록에서 제거.
    { url: `${BASE_URL}/trending`, lastModified: now, changeFrequency: "hourly", priority: 0.6 },
    { url: `${BASE_URL}/keywords`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/keyword`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/blog-type`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // 유형진단 결과 공유 페이지 4종(2026-08 바이럴 장치) — 공유 링크로
    // 유입된 크롤러도 색인할 수 있게 등재.
    ...Object.values(GROUP_SLUGS).map((slug) => ({
      url: `${BASE_URL}/blog-type/result/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
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
    ...keywordEntries,
  ];
}
