import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://ezzsearch.com";
const SITE_TITLE = "ezzsearch — 네이버 키워드 검색량 조회 & 블로그지수";
const SITE_DESCRIPTION =
  "키워드 검색량과 연관검색어를 빠르게 조회하고, 블로그지수에서 경쟁업체 노출·콘텐츠 진단까지 한눈에 관리하세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — ezzsearch",
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "ezzsearch",
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
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ezzsearch",
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
        {children}
      </body>
    </html>
  );
}
