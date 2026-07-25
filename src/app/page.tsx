import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import SiteHeader from "@/components/SiteHeader";
import CategoryTopKeywordsPanel from "@/components/CategoryTopKeywordsPanel";
import Reveal from "@/components/Reveal";
import PainPointPromo from "@/components/PainPointPromo";
import AmbientParticles from "@/components/AmbientParticles";
import StatCounters from "@/components/StatCounters";
import TrendTicker from "@/components/TrendTicker";
import MobileStickyCta from "@/components/MobileStickyCta";
import TrendingKeywordsCards from "@/components/trending/TrendingKeywordsCards";
import { CATEGORIES, getCategoryTopKeywords } from "@/lib/naver/categoryTrends";
import { getSiteStats } from "@/lib/notion/stats";
import { fetchTrendingKeywordsWithNaverVolume } from "@/lib/googleTrends/client";
import type { NormalizedKeywordRow } from "@/lib/naver/types";

const TRENDING_PREVIEW_COUNT = 4;

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "월별 검색량",
    desc: "PC와 모바일 검색량을 구분해 정확한 데이터를 확인하세요.",
    icon: (
      <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
    ),
  },
  {
    title: "연관 키워드",
    desc: "입력한 키워드와 관련된 연관 키워드를 함께 조회하세요.",
    icon: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </>
    ),
  },
  {
    title: "CSV 다운로드",
    desc: "검색 결과를 CSV 파일로 내려받아 바로 활용하세요.",
    icon: (
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    ),
  },
  {
    title: "검색 이력",
    desc: "최근 검색 세션을 다시 불러와 이어서 확인하세요.",
    icon: (
      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" />
    ),
  },
];

const FACTS = [
  { value: "무료", label: "회원가입 불필요" },
  { value: "5개", label: "키워드 동시 비교" },
  { value: "CSV", label: "다운로드 지원" },
];

const USE_CASES = [
  {
    title: "블로그 운영자",
    desc: "다음 글감을 감이 아니라 실제 검색량 기준으로 정하세요.",
    icon: (
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    ),
  },
  {
    title: "소상공인 사장님",
    desc: "우리 가게 관련 검색어를 확인하고, 블로그지수로 경쟁사와 비교해보세요.",
    icon: (
      <path d="M3 21h18M4 21V9l8-6 8 6v12M9 21v-6h6v6" />
    ),
  },
  {
    title: "마케터",
    desc: "캠페인을 시작하기 전에 키워드 검색량으로 수요를 미리 가늠하세요.",
    icon: (
      <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
    ),
  },
  {
    title: "예비 창업자",
    desc: "관심 있는 아이템의 실제 검색 관심도를 데이터로 확인하세요.",
    icon: (
      <>
        <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
      </>
    ),
  },
];

const STEPS = [
  {
    title: "키워드 입력",
    desc: "검색하고 싶은 키워드를 입력하세요. 콤마로 구분해 최대 5개까지 가능해요.",
  },
  {
    title: "결과 확인",
    desc: "PC/모바일 검색량과 연관 키워드를 그래프와 표로 확인하세요.",
  },
  {
    title: "필요하면 저장",
    desc: "CSV로 내려받거나, 블로그지수에서 경쟁사와 바로 비교해보세요.",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const category = CATEGORIES.find((c) => c.id === categoryParam) ?? CATEGORIES[0];

  const [categoryTrend, siteStats, trending] = await Promise.all([
    getCategoryTopKeywords(category.id).catch(() => null),
    getSiteStats().catch(() => null),
    fetchTrendingKeywordsWithNaverVolume().catch(() => null),
  ]);
  const categoryRows: NormalizedKeywordRow[] = categoryTrend?.rows ?? [];

  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />

      <main className="flex flex-1 flex-col items-center">
        {/* Hero */}
        <section className="flex w-full flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
          <div className="relative isolate mx-auto flex w-full max-w-2xl flex-col items-center gap-6 overflow-hidden py-4">
            <AmbientParticles />
            <div className="relative z-10 flex flex-col items-center gap-6">
              <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
                무료 · 회원가입 불필요
              </span>
              <div className="flex flex-col items-center gap-3">
                <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-6xl">
                  <span className="text-primary">네이버 키워드</span> 검색량 조회
                </h1>
                <p className="max-w-md text-sm text-ink-muted sm:text-base">
                  키워드를 입력하면 검색량(한 달 동안 이 단어를 검색한 횟수)과
                  연관 키워드를 무료로 조회합니다.
                </p>
              </div>
            </div>
          </div>

          <div id="hero-search" className="flex w-full flex-col items-center gap-6">
            <div className="w-full max-w-xl">
              <SearchForm />
            </div>

            <div className="w-full max-w-xl">
              <CategoryTopKeywordsPanel
                categories={CATEGORIES}
                initialCategory={category}
                initialRows={categoryRows}
                initialFetchedAt={categoryTrend?.fetchedAt ?? null}
                initialError={!categoryTrend}
              />
            </div>
          </div>
        </section>

        {trending && trending.length > 0 && (
          <section className="w-full border-t border-hairline px-4 py-12 sm:px-6 sm:py-16">
            <Reveal className="mx-auto flex max-w-4xl flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  요즘 뜨는 검색어
                </h2>
                <Link href="/trending" className="text-sm font-medium text-primary hover:underline">
                  더보기 →
                </Link>
              </div>
              <TrendingKeywordsCards items={trending.slice(0, TRENDING_PREVIEW_COUNT)} />
            </Reveal>
          </section>
        )}

        {siteStats && (
          <section className="w-full border-t border-hairline bg-surface px-4 py-10 sm:px-6">
            <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-4">
              <StatCounters
                stats={[
                  { value: siteStats.searchSessions, label: "누적 검색 세션" },
                  { value: siteStats.keywordsChecked, label: "조회된 키워드" },
                  { value: siteStats.blogScoreSessions, label: "블로그지수 조회" },
                ]}
              />
            </Reveal>
          </section>
        )}

        <PainPointPromo
          heading="이런 고민, 키워드 검색량 조회가 해결해드려요"
          points={[
            {
              question: "어떤 키워드로 글을 써야 할지 모르겠어요.",
              title: "연관 키워드 추천",
              points: [
                "입력한 키워드와 관련된 연관 키워드를 함께 제공",
                "검색량 높은 순으로 정렬해서 바로 확인",
                "무료로 몇 번이든 조회 가능",
              ],
            },
            {
              question: "검색량이 진짜 맞는지 못 믿겠어요.",
              title: "네이버 공식 데이터 기반",
              points: [
                "네이버 검색광고 API 기준 정확한 PC·모바일 검색량",
                "데이터 근거 있는 콘텐츠 기획 가능",
                "CSV로 저장해 바로 활용",
              ],
            },
          ]}
        />

        {/* Features */}
        <section className="w-full border-t border-hairline bg-surface px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Features
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                이런 기능을 제공해요
              </h2>
            </div>
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="flex flex-col gap-3 rounded-lg border border-hairline bg-bg p-4 sm:p-5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      {f.icon}
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                  <p className="text-sm text-ink-muted">{f.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <TrendTicker />

        {/* Facts band (no fabricated usage stats — only true, factual claims) */}
        <section className="w-full bg-primary px-4 py-14 sm:px-6">
          <Reveal className="mx-auto grid max-w-4xl grid-cols-1 gap-8 text-center sm:grid-cols-3">
            {FACTS.map((f) => (
              <div key={f.label}>
                <div className="text-2xl font-bold text-white sm:text-3xl">
                  {f.value}
                </div>
                <div className="mt-1 text-sm text-white/80">{f.label}</div>
              </div>
            ))}
          </Reveal>
        </section>

        {/* Use cases */}
        <section className="w-full border-t border-hairline px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Use Cases
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                이런 분들이 쓰고 있어요
              </h2>
            </div>
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
              {USE_CASES.map((u) => (
                <div
                  key={u.title}
                  className="flex items-start gap-4 rounded-lg border border-hairline bg-surface p-5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-white">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      {u.icon}
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-ink">{u.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{u.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* How it works */}
        <section className="w-full px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                How it works
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                3단계로 시작하세요
              </h2>
            </div>
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <div
                  key={s.title}
                  className="flex flex-col items-center gap-3 rounded-lg border border-hairline bg-surface p-6 text-center"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg text-sm font-bold text-primary">
                    {i + 1}
                  </div>
                  <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                  <p className="text-sm text-ink-muted">{s.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* CTA */}
        <section className="w-full border-t border-hairline bg-surface px-4 py-16 text-center sm:px-6 sm:py-20">
          <Reveal className="flex w-full flex-col items-center gap-5">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              지금 바로 시작해보세요
            </h2>
            <p className="text-sm text-ink-muted sm:text-base">
              회원가입 없이 무료로 이용할 수 있습니다
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="#hero-search"
                className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
              >
                키워드 검색하기
              </a>
              <Link
                href="/dashboard"
                className="rounded-md border border-hairline px-6 py-3 text-sm font-semibold text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97]"
              >
                블로그지수 시작하기
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="w-full border-t border-hairline bg-bg px-4 py-8 pb-24 sm:px-6 sm:pb-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 text-xs text-ink-muted sm:flex-row">
          <span>© 2026 ezzsearch. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-primary">
              키워드 검색량
            </Link>
            <Link href="/dashboard" className="hover:text-primary">
              블로그지수
            </Link>
            <Link href="/trending" className="hover:text-primary">
              급상승
            </Link>
            <Link href="/guide" className="hover:text-primary">
              가이드
            </Link>
            <Link href="/contact" className="hover:text-primary">
              문의하기
            </Link>
          </div>
        </div>
      </footer>

      <MobileStickyCta href="#hero-search" label="키워드 검색하기" />
    </div>
  );
}
