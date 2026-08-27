import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import BlogTypeQuiz from "@/components/blogType/BlogTypeQuiz";

export const metadata: Metadata = {
  title: "내 블로그 유형 진단",
  description: "4가지 질문으로 알아보는 내 블로그 유형 — 프리랜서·자영업자 블로거를 위한 가벼운 진단 테스트예요.",
};

// 완전히 정적인 페이지 — 4문항 진단이 순수 클라이언트 계산(BlogTypeQuiz.tsx)
// 이라 서버에서 조회할 데이터가 없음(§CLAUDE.md 25, "규칙 기반이라 AI 비용
// 없음"과 같은 이유로 서버 렌더링 비용도 없음).
export default function BlogTypePage() {
  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-8 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex w-full max-w-xl flex-col items-center gap-2 text-center">
          <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
            무료 · 30초 진단
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">내 블로그 유형 진단</h1>
          <p className="text-sm text-ink-muted">
            프리랜서·자영업자 블로거를 위한 가벼운 테스트예요. 4가지 질문에 답하면 내 유형과 이번 주 글감을 알려드려요.
          </p>
        </div>

        <div className="w-full max-w-xl">
          <BlogTypeQuiz />
        </div>

        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
          내 블로그 지수도 궁금하다면? →
        </Link>
      </main>
    </div>
  );
}
