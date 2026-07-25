// Buckets raw referrer/landing-path values into a small, stable set of
// Notion select options — admin dashboards need aggregable categories, not
// a select field that grows one new option per unique URL. Order matters:
// more specific prefixes must come before broader ones that would also
// match (e.g. "/dashboard/" before bare "/dashboard").
const LANDING_PAGE_BUCKETS: { prefix: string; label: string }[] = [
  { prefix: "/result", label: "검색 결과" },
  { prefix: "/dashboard/", label: "블로그지수 결과" },
  { prefix: "/dashboard", label: "블로그지수 입력" },
  { prefix: "/trending", label: "검색량 급상승" },
  { prefix: "/guide", label: "가이드" },
  { prefix: "/contact", label: "문의하기" },
];

export function categorizeLandingPage(pathname: string): string {
  if (pathname === "/") return "홈";
  for (const { prefix, label } of LANDING_PAGE_BUCKETS) {
    if (pathname.startsWith(prefix)) return label;
  }
  return pathname;
}

const KNOWN_REFERRER_LABELS: { match: (host: string) => boolean; label: string }[] = [
  { match: (h) => h.includes("naver.com"), label: "네이버" },
  { match: (h) => h.includes("google."), label: "구글" },
  { match: (h) => h.includes("kakao.com") || h.includes("kakaocorp"), label: "카카오" },
  { match: (h) => h.includes("instagram.com"), label: "인스타그램" },
  { match: (h) => h.includes("facebook.com") || h.includes("fb.com"), label: "페이스북" },
  { match: (h) => h.includes("daum.net"), label: "다음" },
];

// siteOrigin lets a same-site referrer (e.g. /guide → /) be labeled as
// internal navigation instead of miscategorized as "an external referrer
// happened to be this domain."
export function categorizeReferrer(refererHeader: string | null, siteOrigin: string): string {
  if (!refererHeader) return "직접 방문";

  try {
    const url = new URL(refererHeader);
    if (url.origin === siteOrigin) return "사이트 내 이동";
    for (const { match, label } of KNOWN_REFERRER_LABELS) {
      if (match(url.hostname)) return label;
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "직접 방문";
  }
}
