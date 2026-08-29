import { Fragment } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import AmbientParticles from "@/components/AmbientParticles";
import PersonaTabs from "@/components/search/PersonaTabs";
import StatCounters from "@/components/search/StatCounters";
import MobileStickyCta from "@/components/MobileStickyCta";
import TrendingKeywordsCards from "@/components/trending/TrendingKeywordsCards";
import RecentKeywordTicker from "@/components/search/RecentKeywordTicker";
import { getSiteStats } from "@/lib/notion/stats";
import { fetchTrendingKeywordsWithNaverVolume } from "@/lib/googleTrends/client";
import { getPolicyPosts } from "@/lib/notion/policyBoard";
import { getRecentSearchKeywords } from "@/lib/notion/sessions";
import { getKeywordDirectorySet } from "@/lib/notion/keywordSnapshots";
import { formatKstDateTime } from "@/lib/utils/formatDate";

const TRENDING_PREVIEW_COUNT = 4;
const POLICY_PREVIEW_COUNT = 4;

export const dynamic = "force-dynamic";

// 2026-08 재설계(1단계) — 홈을 13개 섹션에서 6개로 재구성함(사용자 확정).
// 첫 훅이 키워드 검색창에서 "블로그 주소 하나 입력 → 즉시 무료 진단"으로
// 바뀌었고(키워드 검색은 /search로 이동), 제품 서사를 성장 루프(진단→계획→
// 작성→추적) 하나로 통일함. 이전 홈에 있던 FeatureShowcase·PainPointPromo·
// 기능소개·이용사례·팩트밴드·TrendTicker·게시판 미리보기는 의도적으로 뺀 것
// — 섹션 상한(6~7개) 규율을 지키기 위해서이니 "허전해 보인다"고 다시 쌓지
// 말 것. FeatureShowcase와 PainPointPromo(키워드 버전)는 /search에 살아있음.

// 성장 루프 4단계 — 내비게이션 그룹(SiteHeader.NAV_GROUPS)과 같은 축.
const LOOP_STEPS = [
  {
    step: "진단",
    title: "내 위치 알기",
    desc: "내 블로그(가게)가 네이버에서 어떻게 보이는지 점수와 노출 순위로 확인해요.",
    href: "/dashboard",
    linkLabel: "블로그 진단",
  },
  {
    step: "계획",
    title: "뭘 쓸지 정하기",
    desc: "검색량·연관 키워드·급상승 데이터로 다음 글감을 감이 아니라 숫자로 정해요.",
    href: "/search",
    linkLabel: "키워드 조회",
  },
  {
    step: "작성",
    title: "실제로 쓰기",
    desc: "정한 키워드로, 저품질 위험 신호 없이 — AI가 초안 작성을 도와드려요.",
    href: "/write",
    linkLabel: "AI 글쓰기",
  },
  {
    step: "추적",
    title: "변화 확인하기",
    desc: "관심 키워드의 검색량이 크게 바뀌면 이메일로 알려드려요. 다시 진단으로!",
    href: "/mypage",
    linkLabel: "내 정보",
  },
];

// 단계 카드 사이 점선 화살표 — PainPointPromo.tsx의 Arrow와 같은 시각 모티프.
function StepArrow() {
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" fill="none" aria-hidden className="hidden text-hairline sm:block">
      <line x1="0" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      <path
        d="M16 3l6 5-6 5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function Home() {
  const [siteStats, trending, policyPreview, recentKeywords, dictionarySet] = await Promise.all([
    getSiteStats().catch(() => null),
    fetchTrendingKeywordsWithNaverVolume().catch(() => null),
    getPolicyPosts()
      .then((r) => r.posts.slice(0, POLICY_PREVIEW_COUNT))
      .catch(() => []),
    // 활성 신호(티커)·사전 링크용 — 실패해도 페이지는 그대로 렌더링.
    getRecentSearchKeywords(14).catch(() => []),
    getKeywordDirectorySet().catch(() => new Set<string>()),
  ]);

  // 사전 페이지가 실제로 존재하는 키워드만 티커에 노출 — 404 링크 방지.
  const tickerKeywords = recentKeywords.filter((k) => dictionarySet.has(k)).slice(0, 12);

  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />

      <main className="flex flex-1 flex-col items-center">
        {/* ① Hero — 타겟 3버튼 + 블로그 진단 입력 훅 */}
        <section className="flex w-full flex-col items-center gap-8 px-4 py-20 text-center sm:px-6 sm:py-28">
          <div className="relative isolate mx-auto flex w-full max-w-2xl flex-col items-center gap-6 overflow-hidden py-4">
            <AmbientParticles />
            <div className="relative z-10 flex flex-col items-center gap-6">
              <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
                무료 · 회원가입 불필요
              </span>
              <div className="flex flex-col items-center gap-3">
                <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-6xl">
                  네이버에서 <span className="text-primary">손님이 찾아오게</span>
                  <br className="hidden sm:block" /> 만드세요
                </h1>
                <p className="max-w-lg text-sm text-ink-muted sm:text-base">
                  블로그 진단부터 키워드 선정, AI 글쓰기, 변화 추적까지 — 소상공인·프리랜서·블로거를
                  위한 블로그 성장 도구입니다.
                </p>
              </div>
            </div>
          </div>

          <PersonaTabs />

          {/* 진단 입력 — JS 없는 GET 폼: /dashboard가 ?blog=로 프리필함 */}
          <div id="hero-checkup" className="flex w-full max-w-xl flex-col items-center gap-3">
            <form
              action="/dashboard"
              method="get"
              className="flex w-full flex-col gap-2 rounded-lg border-2 border-hairline bg-surface p-3 shadow-sm transition-colors focus-within:border-primary sm:flex-row"
            >
              <input
                type="text"
                name="blog"
                placeholder="예: blog.naver.com/my_blog"
                aria-label="블로그 주소"
                className="h-12 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                className="h-12 shrink-0 rounded-md bg-primary px-6 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
              >
                무료로 진단하기
              </button>
            </form>
            <p className="text-xs text-ink-muted">
              키워드 검색량이 궁금하세요?{" "}
              <Link href="/search" className="font-medium text-primary hover:underline">
                키워드 검색량 조회 →
              </Link>
            </p>
          </div>

          <RecentKeywordTicker keywords={tickerKeywords} />
        </section>

        {/* ② 성장 루프 4단계 */}
        <section className="w-full border-t border-hairline bg-surface px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-xs font-bold tracking-wide text-primary">이렇게 돌아가요</span>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                매주 반복하는 블로그 성장 루틴
              </h2>
            </div>
            <div className="grid w-full grid-cols-1 items-stretch gap-6 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:gap-2">
              {LOOP_STEPS.map((s, i) => (
                <Fragment key={s.step}>
                  <Link
                    href={s.href}
                    className="group flex flex-col gap-2 rounded-lg border border-hairline bg-bg p-5 text-left transition hover:border-primary"
                  >
                    <span className="text-xs font-bold tracking-wide text-primary">
                      STEP {i + 1} · {s.step}
                    </span>
                    <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                    <p className="flex-1 text-sm text-ink-muted">{s.desc}</p>
                    <span className="text-xs font-semibold text-primary group-hover:underline">
                      {s.linkLabel} →
                    </span>
                  </Link>
                  {i < LOOP_STEPS.length - 1 && (
                    <div className="hidden items-center justify-center sm:flex">
                      <StepArrow />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ③ 오늘의 데이터 — 급상승 + 정책정보를 한 섹션으로 압축 */}
        {((trending && trending.length > 0) || policyPreview.length > 0) && (
          <section className="w-full border-t border-hairline px-4 py-16 sm:px-6 sm:py-20">
            <Reveal className="mx-auto flex max-w-4xl flex-col gap-8">
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="text-xs font-bold tracking-wide text-primary">오늘의 데이터</span>
                <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  지금 확인할 만한 소식
                </h2>
              </div>

              {trending && trending.length > 0 && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold tracking-tight text-ink">요즘 뜨는 검색어</h3>
                    <Link href="/trending" className="text-sm font-medium text-primary hover:underline">
                      더보기 →
                    </Link>
                  </div>
                  <TrendingKeywordsCards
                    items={trending.slice(0, TRENDING_PREVIEW_COUNT)}
                    dictionaryKeywords={dictionarySet}
                  />
                </div>
              )}

              {policyPreview.length > 0 && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold tracking-tight text-ink">소상공인 정책정보</h3>
                    <Link href="/policy-board" className="text-sm font-medium text-primary hover:underline">
                      더보기 →
                    </Link>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    {policyPreview.map((post) => (
                      <Link
                        key={post.id}
                        href={`/policy-board/${post.id}`}
                        className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition hover:border-primary"
                      >
                        <span className="w-fit rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-ink-muted">
                          {post.category || "소상공인뉴스"}
                        </span>
                        <p className="text-sm font-semibold text-ink">{post.title}</p>
                        <span className="text-xs text-ink-muted">{formatKstDateTime(post.postedAt)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </Reveal>
          </section>
        )}

        {/* ④ 신뢰 지표 */}
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

        {/* ⑤ 유형 진단 배너 — 가벼운 재미 진입점 (§CLAUDE.md 25) */}
        <section className="w-full border-t border-hairline px-4 py-12 sm:px-6 sm:py-16">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-2xl bg-primary px-6 py-10 text-center sm:px-10">
            <span className="text-4xl">🔍</span>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">내 블로그 유형, 궁금하지 않으세요?</h2>
            <p className="max-w-md text-sm text-white/85">
              4가지 질문에 답하면 내 블로그 유형과 이번 주 글감을 알려드려요. 회원가입 없이, 30초면 충분해요.
            </p>
            <Link
              href="/blog-type"
              className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-primary transition ease-spring hover:bg-white/90 motion-safe:active:scale-[0.97]"
            >
              유형 진단 받아보기 →
            </Link>
          </Reveal>
        </section>

        {/* ⑥ 최종 CTA */}
        <section className="w-full border-t border-hairline bg-surface px-4 py-16 text-center sm:px-6 sm:py-20">
          <Reveal className="flex w-full flex-col items-center gap-5">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              3분이면 내 블로그의 현재 위치를 알 수 있어요
            </h2>
            <p className="text-sm text-ink-muted sm:text-base">
              회원가입 없이 무료로 이용할 수 있습니다
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="#hero-checkup"
                className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
              >
                무료로 진단 받기
              </a>
              <Link
                href="/search"
                className="rounded-md border border-hairline px-6 py-3 text-sm font-semibold text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97]"
              >
                키워드 검색하기
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
      <MobileStickyCta href="#hero-checkup" label="무료 진단 받기" />
    </div>
  );
}
