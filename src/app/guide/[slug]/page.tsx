import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { GUIDE_ARTICLES, getGuideArticle, getRelatedGuideArticles } from "@/lib/guide/articles";

const SITE_URL = "https://ezzsearch.com";

export function generateStaticParams() {
  return GUIDE_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getGuideArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
  };
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getGuideArticle(slug);
  if (!article) notFound();
  const relatedArticles = getRelatedGuideArticles(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    url: `${SITE_URL}/guide/${article.slug}`,
    author: { "@type": "Organization", name: "ezzsearch" },
    publisher: { "@type": "Organization", name: "ezzsearch" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/guide/${article.slug}` },
  };

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
        <div>
          <Link href="/guide" className="text-xs text-ink-muted hover:text-primary">
            ← 가이드 목록
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {article.title}
          </h1>
          <p className="mt-2 text-xs text-ink-muted">{article.publishedAt}</p>
        </div>

        <article className="flex flex-col gap-6">
          {article.sections.map((section, i) => (
            <div key={i} className="flex flex-col gap-2">
              {section.heading && (
                <h2 className="text-lg font-semibold text-ink">{section.heading}</h2>
              )}
              {section.paragraphs.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed text-ink-muted sm:text-base">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </article>

        {relatedArticles.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-hairline pt-6">
            <h2 className="text-sm font-semibold text-ink">관련 가이드</h2>
            <ul className="flex flex-col gap-2">
              {relatedArticles.map((related) => (
                <li key={related.slug}>
                  <Link
                    href={`/guide/${related.slug}`}
                    className="text-sm text-ink-muted transition-colors hover:text-primary"
                  >
                    {related.title} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-sm text-ink-muted">직접 키워드를 조회해보세요.</p>
          <div className="flex justify-center gap-2 sm:justify-end">
            <Link
              href="/"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
            >
              키워드 검색량 조회
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97]"
            >
              블로그지수 확인
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
