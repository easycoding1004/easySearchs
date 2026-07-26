import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Reveal from "@/components/Reveal";
import { CATEGORIES } from "@/lib/naver/categoryTrends";

export const metadata: Metadata = {
  title: "업종별 인기 검색어",
  description:
    "외식·카페·패션·뷰티 등 업종별로 실제 네이버 검색량이 높은 키워드를 확인하세요.",
};

export default function KeywordsIndexPage() {
  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center">
        <section className="flex w-full flex-col items-center gap-4 px-4 py-16 text-center sm:px-6 sm:py-20">
          <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
            무료 · 회원가입 불필요
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
            업종별 <span className="text-primary">인기 검색어</span>
          </h1>
          <p className="max-w-md text-sm text-ink-muted sm:text-base">
            업종별 대표 키워드의 연관 검색어 중 실제 검색량이 높은 순으로 정리했어요.
          </p>
        </section>

        <section className="w-full px-4 pb-20 sm:px-6">
          <Reveal className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
            {CATEGORIES.map((category) => (
              <Link
                key={category.id}
                href={`/keywords/${category.id}`}
                className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-5 transition-colors hover:border-primary"
              >
                <span className="text-base font-semibold text-ink">{category.label}</span>
                <span className="text-sm text-ink-muted">
                  &quot;{category.seedKeyword}&quot; 연관 검색어 TOP 10 보기 →
                </span>
              </Link>
            ))}
          </Reveal>
        </section>
      </main>
    </div>
  );
}
