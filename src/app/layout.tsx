import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ezzsearch — 네이버 키워드 검색량 조회 & 블로그지수",
  description:
    "키워드 검색량과 연관검색어를 빠르게 조회하고, 블로그지수에서 경쟁업체 노출·콘텐츠 진단까지 한눈에 관리하세요.",
  icons: {
    icon: "/easyserch_icon.svg",
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
