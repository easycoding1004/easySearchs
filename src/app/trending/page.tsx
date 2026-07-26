import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Reveal from "@/components/Reveal";
import TrendingKeywordsTable from "@/components/trending/TrendingKeywordsTable";
import RisingKeywordsTable from "@/components/trending/RisingKeywordsTable";
import { fetchTrendingKeywordsWithNaverVolume } from "@/lib/googleTrends/client";
import { getRisingKeywords } from "@/lib/notion/keywordSnapshots";
import { RISING_KEYWORD_MIN_DAYS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "검색량 급상승",
  description:
    "구글 트렌드 기준 요즘 뜨는 검색어와 실제 네이버 검색량, 이 사이트에서 조회된 키워드의 자체 상승률을 함께 확인하세요.",
};

export const dynamic = "force-dynamic";

async function settle<T>(fetcher: () => Promise<T>) {
  try {
    return { ok: true as const, value: await fetcher() };
  } catch (err) {
    console.error("[TrendingPage] panel fetch failed:", err);
    return { ok: false as const };
  }
}

export default async function TrendingPage() {
  const trendingResult = await settle(() => fetchTrendingKeywordsWithNaverVolume());
  const risingResult = await settle(() => getRisingKeywords(RISING_KEYWORD_MIN_DAYS));

  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />

      <main className="flex flex-1 flex-col items-center">
        <section className="flex w-full flex-col items-center gap-4 px-4 py-16 text-center sm:px-6 sm:py-20">
          <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
            무료 · 회원가입 불필요
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
            검색량 <span className="text-primary">급상승</span> 키워드
          </h1>
          <p className="max-w-md text-sm text-ink-muted sm:text-base">
            네이버는 실시간급상승검색어를 제공하지 않아요. 대신 구글 트렌드로 요즘 뜨는 주제를
            찾고, 실제 네이버 검색량을 함께 보여드려요.
          </p>
        </section>

        <section className="w-full border-t border-hairline bg-surface px-4 py-12 sm:px-6 sm:py-16">
          <Reveal className="mx-auto flex max-w-4xl flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                요즘 뜨는 검색어
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                구글 트렌드 기준(한국) — 네이버 자체 순위가 아니며, 관심도는 구글 검색 기준
                지표예요. 함께 표시되는 검색량은 실제 네이버 데이터입니다.
              </p>
            </div>
            {trendingResult.ok ? (
              trendingResult.value.length > 0 ? (
                <TrendingKeywordsTable items={trendingResult.value} />
              ) : (
                <div className="rounded-md border border-dashed border-hairline p-6 text-center text-sm text-ink-muted">
                  지금은 불러올 트렌드 항목이 없어요. 잠시 후 다시 확인해주세요.
                </div>
              )
            ) : (
              <div className="rounded-md border border-dashed border-hairline p-6 text-center text-sm text-ink-muted">
                일시적으로 구글 트렌드를 불러오지 못했어요. 잠시 후 다시 확인해주세요.
              </div>
            )}
          </Reveal>
        </section>

        <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
          <Reveal className="mx-auto flex max-w-4xl flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                우리 데이터 기준 상승 키워드
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                이 사이트에서 실제 조회된 키워드의 네이버 검색량 변화를 기준으로 해요. 데이터가
                쌓일수록 정확해져요.
              </p>
            </div>
            {risingResult.ok ? (
              <RisingKeywordsTable items={risingResult.value} />
            ) : (
              <div className="rounded-md border border-dashed border-hairline p-6 text-center text-sm text-ink-muted">
                일시적으로 데이터를 불러오지 못했어요. 잠시 후 다시 확인해주세요.
              </div>
            )}
          </Reveal>
        </section>

        <section className="w-full border-t border-hairline bg-surface px-4 py-16 text-center sm:px-6 sm:py-20">
          <Reveal className="flex w-full flex-col items-center gap-5">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              키워드를 직접 조회해보세요
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
              >
                키워드 검색량 조회
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md border border-hairline px-6 py-3 text-sm font-semibold text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97]"
              >
                블로그지수 확인
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="w-full border-t border-hairline bg-bg px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 text-xs text-ink-muted sm:flex-row">
          <span>© 2026 ezzsearch. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-primary">
              키워드 검색량
            </Link>
            <Link href="/dashboard" className="hover:text-primary">
              블로그지수
            </Link>
            <Link href="/guide" className="hover:text-primary">
              가이드
            </Link>
            <Link href="/contact" className="hover:text-primary">
              문의하기
            </Link>
            <Link href="/privacy" className="hover:text-primary">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
