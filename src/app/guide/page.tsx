import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { GUIDE_ARTICLES } from "@/lib/guide/articles";

export const metadata: Metadata = {
  title: "가이드",
  description: "네이버 키워드 검색량과 블로그지수를 활용하는 방법을 정리한 가이드예요.",
};

export default function GuideIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col gap-2 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Guide</span>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">가이드</h1>
          <p className="text-sm text-ink-muted">
            키워드 검색량과 블로그지수를 실제로 어떻게 활용하면 좋을지 정리했어요.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {GUIDE_ARTICLES.map((article) => (
            <Link
              key={article.slug}
              href={`/guide/${article.slug}`}
              className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface p-5 transition-colors hover:border-primary"
            >
              <h2 className="text-base font-semibold text-ink">{article.title}</h2>
              <p className="text-sm text-ink-muted">{article.description}</p>
              <span className="text-xs text-ink-muted">{article.publishedAt}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
