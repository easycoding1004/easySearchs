import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Reveal from "@/components/Reveal";
import { CATEGORIES, getCategoryTopKeywords } from "@/lib/naver/categoryTrends";
import { getCategoryShoppingDirection } from "@/lib/naver/categoryShoppingTrend";
import { formatKstDateTime } from "@/lib/utils/formatDate";

const SITE_URL = "https://ezzsearch.com";

const COMPETITION_STYLE: Record<string, string> = {
  낮음: "text-success",
  중간: "text-ink-muted",
  높음: "text-error",
};

// Not statically generated: getCategoryTopKeywords already has its own
// process-wide 1-hour TTL cache (categoryTrends.ts), so SSG would buy
// nothing here — it would only add 8 extra Naver keywordstool calls to
// every build, which can fail the build outright on a 429 (found via a
// real build failure: this page's generateStaticParams once called it for
// all 8 categories concurrently during static generation).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}): Promise<Metadata> {
  const { categoryId } = await params;
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return {};
  return {
    title: `${category.label} 인기 검색어 TOP 10`,
    description: `${category.label} 업종의 실제 네이버 검색량 기준 인기 검색어를 확인하세요.`,
  };
}

export default async function KeywordsCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) notFound();

  const [{ rows, fetchedAt }, shoppingDirection] = await Promise.all([
    getCategoryTopKeywords(categoryId),
    getCategoryShoppingDirection(categoryId),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category.label} 인기 검색어`,
    url: `${SITE_URL}/keywords/${category.id}`,
    itemListElement: rows.map((row, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: row.relKeyword,
    })),
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
          <Link href="/keywords" className="text-xs text-ink-muted hover:text-primary">
            ← 업종별 인기 검색어
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {category.label} 인기 검색어 TOP {rows.length}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            &quot;{category.seedKeyword}&quot; 연관 검색어 중 실제 네이버 검색량이 높은 순이에요
            — 네이버 공식 인기 검색어 순위가 아니에요.
          </p>
          {fetchedAt && (
            <p className="mt-1 text-xs text-ink-muted">{formatKstDateTime(fetchedAt)} 기준</p>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-hairline p-6 text-center text-sm text-ink-muted">
            지금은 불러올 데이터가 없어요. 잠시 후 다시 확인해주세요.
          </p>
        ) : (
          <Reveal className="overflow-hidden rounded-lg border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-surface text-left text-xs text-ink-muted">
                  <th className="px-4 py-2 font-medium">순위</th>
                  <th className="px-4 py-2 font-medium">키워드</th>
                  <th className="px-4 py-2 text-right font-medium">월간 검색량</th>
                  <th className="px-4 py-2 text-right font-medium">경쟁정도</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.relKeyword} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-2.5 text-ink-muted">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-ink">{row.relKeyword}</td>
                    <td className="px-4 py-2.5 text-right text-ink">
                      {(row.monthlyPcQcCnt + row.monthlyMobileQcCnt).toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        row.compIdx ? COMPETITION_STYLE[row.compIdx] : "text-ink-muted"
                      }`}
                    >
                      {row.compIdx ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        )}

        {shoppingDirection && (
          <p className="text-sm text-ink-muted">
            {category.label} 쇼핑 관심도(최근 3개월):{" "}
            <span className="font-semibold text-ink">{shoppingDirection}</span>
          </p>
        )}

        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-sm text-ink-muted">이 키워드들의 검색량을 직접 조회해보세요.</p>
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
