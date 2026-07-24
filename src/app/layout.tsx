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
    images: [{ url: "/ezzsearch_logo.png", width: 1285, height: 438, alt: "ezzsearch" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/ezzsearch_logo.png"],
  },
  other: {
    "naver-site-verification": "7b6573f18ff8e86489146eb4ac6d99e7a5425ef5",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-bg">{children}</body>
    </html>
  );
}
