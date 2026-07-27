import type { Metadata } from "next";
import "./globals.css";
import { NAV_LINKS } from "@/components/SiteHeader";

// Display brand name only — the domain, email addresses (contact@,
// trending@ezzsearch.com), and internal file/route names deliberately stay
// "ezzsearch" (changing those would need a new domain + email re-verification,
// which the user explicitly chose not to do).
const BRAND_NAME = "이지서치";
const SITE_URL = "https://ezzsearch.com";
const SITE_TITLE = `${BRAND_NAME} — 네이버 키워드 검색량 조회 & 블로그지수`;
const SITE_DESCRIPTION =
  "키워드 검색량과 연관검색어를 빠르게 조회하고, 블로그지수에서 경쟁업체 노출·콘텐츠 진단까지 한눈에 관리하세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${BRAND_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: BRAND_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    // Image comes from opengraph-image.tsx's file-convention route (auto
    // 1200x630 branded card) — specifying images here too would risk a
    // duplicate/conflicting og:image tag alongside it.
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  other: {
    "naver-site-verification": "7b6573f18ff8e86489146eb4ac6d99e7a5425ef5",
  },
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/guide/rss.xml", title: `${BRAND_NAME} 가이드` }],
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: BRAND_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "KRW",
  },
};

// Hints Google's sitelinks-style algorithm that these are the site's main
// sections (mirrors SiteHeader.tsx's own NAV_LINKS, so it can never drift
// out of sync with the actual nav) — this does NOT guarantee Google shows
// them under the search snippet, that's entirely Google's own call.
const siteNavigationJsonLd = {
  "@context": "https://schema.org",
  "@graph": NAV_LINKS.map((link) => ({
    "@type": "SiteNavigationElement",
    name: link.label,
    url: link.href === "/" ? SITE_URL : `${SITE_URL}${link.href}`,
  })),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-bg">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavigationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
