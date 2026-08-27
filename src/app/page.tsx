import { Fragment } from "react";
import Link from "next/link";
import SearchForm from "@/components/search/SearchForm";
import SiteHeader from "@/components/SiteHeader";
import FeatureShowcase from "@/components/search/FeatureShowcase";
import Reveal from "@/components/Reveal";
import PainPointPromo from "@/components/PainPointPromo";
import AmbientParticles from "@/components/AmbientParticles";
import StatCounters from "@/components/search/StatCounters";
import TrendTicker from "@/components/search/TrendTicker";
import MobileStickyCta from "@/components/MobileStickyCta";
import TrendingKeywordsCards from "@/components/trending/TrendingKeywordsCards";
import { getSiteStats } from "@/lib/notion/stats";
import { fetchTrendingKeywordsWithNaverVolume } from "@/lib/googleTrends/client";
import { getPolicyPosts } from "@/lib/notion/policyBoard";
import { getBoardPosts } from "@/lib/notion/board";
import { formatKstDateTime } from "@/lib/utils/formatDate";

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
  },
  {
    title: "소상공인 사장님",
    desc: "우리 가게 관련 검색어를 확인하고, 블로그지수로 경쟁사와 비교해보세요.",
  },
  {
    title: "마케터",
    desc: "캠페인을 시작하기 전에 키워드 검색량으로 수요를 미리 가늠하세요.",
  },
  {
    title: "예비 창업자",
    desc: "관심 있는 아이템의 실제 검색 관심도를 데이터로 확인하세요.",
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

// FEATURES/USE_CASES 아이콘 svg 래퍼가 반복돼서 하나로 뽑음.
function FeatureIcon({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

// "3단계로 시작하세요" 카드 사이를 잇는 점선 화살표 — PainPointPromo.tsx의
// Arrow와 같은 시각 모티프를 재사용해 페이지 전체의 일관된 신호로 둠.
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

const POLICY_PREVIEW_COUNT = 4;
const BOARD_PREVIEW_COUNT = 4;

export default async function Home() {
  const [siteStats, trending, policyPreview, boardPreview] = await Promise.all([
    getSiteStats().catch(() => null),
    fetchTrendingKeywordsWithNaverVolume().catch(() => null),
    getPolicyPosts()
      .then((r) => r.posts.slice(0, POLICY_PREVIEW_COUNT))
      .catch(() => []),
    // 2026-08 추가(제품 감사 — "게시판이 홈페이지 어디에도 안 보인다") —
    // 정책정보 미리보기와 같은 패턴으로 게시판 최신 글도 보여줌.
    getBoardPosts()
      .then((r) => r.posts.slice(0, BOARD_PREVIEW_COUNT))
      .catch(() => []),
  ]);

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
              <FeatureShowcase />
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

        {policyPreview.length > 0 && (
          <section className="w-full border-t border-hairline bg-surface px-4 py-12 sm:px-6 sm:py-16">
            <Reveal className="mx-auto flex max-w-4xl flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">소상공인 정책정보</h2>
                <Link href="/policy-board" className="text-sm font-medium text-primary hover:underline">
                  더보기 →
                </Link>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {policyPreview.map((post) => (
                  <Link
                    key={post.id}
                    href={`/policy-board/${post.id}`}
                    className="flex flex-col gap-1 rounded-lg border border-hairline bg-bg p-4 transition hover:border-primary"
                  >
                    <span className="w-fit rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted">
                      {post.category || "소상공인뉴스"}
                    </span>
                    <p className="text-sm font-semibold text-ink">{post.title}</p>
                    <span className="text-xs text-ink-muted">{formatKstDateTime(post.postedAt)}</span>
                  </Link>
                ))}
              </div>
            </Reveal>
          </section>
        )}

        {boardPreview.length > 0 && (
          <section className="w-full border-t border-hairline px-4 py-12 sm:px-6 sm:py-16">
            <Reveal className="mx-auto flex max-w-4xl flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">게시판 최신 글</h2>
                <Link href="/board" className="text-sm font-medium text-primary hover:underline">
                  더보기 →
                </Link>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {boardPreview.map((post) => (
                  <Link
                    key={post.id}
                    href={`/board/${post.id}`}
                    className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition hover:border-primary"
                  >
                    <p className="text-sm font-semibold text-ink">
                      {post.title}
                      {post.commentCount > 0 && (
                        <span className="ml-1 font-normal text-primary">[{post.commentCount}]</span>
                      )}
                    </p>
                    <span className="text-xs text-ink-muted">{post.authorNickname || "익명"}</span>
                  </Link>
                ))}
              </div>
            </Reveal>
          </section>
        )}

        {/* 2026-08 추가(§CLAUDE.md 25) — 프리랜서·자영업자 블로거를 위한
            가벼운 "재미" 콘텐츠 진입점. 다른 섹션과 톤을 구분하려고 일부러
            브랜드 컬러 배경(bg-primary)으로 시각적 대비를 줌. */}
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

        {/* Features — 첫 항목을 넓은 "플래그십" 카드로 강조하고 나머지 3개를
            아래 서브 그리드로 두는 비대칭 레이아웃. 4칸이 전부 똑같은 크기의
            아이콘+제목+설명 카드로 반복되던 걸 위계가 드러나게 바꿈. */}
        <section className="w-full border-t border-hairline bg-surface px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-xs font-bold tracking-wide text-primary">핵심 기능</span>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                이런 기능을 제공해요
              </h2>
            </div>
            <div className="flex w-full flex-col gap-4">
              <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-xl border border-hairline bg-bg p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-6 -right-2 text-8xl font-extrabold text-primary/5 sm:text-9xl"
                >
                  01
                </span>
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <FeatureIcon className="h-7 w-7">{FEATURES[0].icon}</FeatureIcon>
                </div>
                <div className="relative flex flex-col gap-1.5">
                  <h3 className="text-lg font-bold text-ink">{FEATURES[0].title}</h3>
                  <p className="text-sm text-ink-muted sm:text-base">{FEATURES[0].desc}</p>
                </div>
              </div>

              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                {FEATURES.slice(1).map((f, i) => {
                  const tint = ["bg-primary/10 text-primary", "bg-accent/20 text-on-brand", "bg-ink/5 text-ink"][i];
                  return (
                    <div key={f.title} className="flex flex-col gap-3 rounded-lg border border-hairline bg-bg p-4 sm:p-5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-md ${tint}`}>
                        <FeatureIcon>{f.icon}</FeatureIcon>
                      </div>
                      <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                      <p className="text-sm text-ink-muted">{f.desc}</p>
                    </div>
                  );
                })}
              </div>
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
                <div className="mt-1 text-sm text-white/90">{f.label}</div>
              </div>
            ))}
          </Reveal>
        </section>

        {/* Use cases — Features 섹션과 리듬이 겹치지 않도록 아이콘 사각형
            대신 큰 고스트 넘버 + 좌측 컬러 바로 카드를 구분하고, 모바일에서는
            가로 스냅 스크롤로 훑어보게 함(4칸을 좁은 화면에 욱여넣지 않음). */}
        <section className="w-full border-t border-hairline px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-xs font-bold tracking-wide text-primary">이용 사례</span>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                이런 분들이 쓰고 있어요
              </h2>
            </div>
            <div className="-mx-4 flex w-[calc(100%+2rem)] snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:w-full sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
              {USE_CASES.map((u, i) => (
                <div
                  key={u.title}
                  className={`relative w-[78%] shrink-0 snap-start overflow-hidden rounded-lg border-l-4 bg-surface p-5 shadow-sm sm:w-auto sm:shrink ${
                    i % 2 === 0 ? "border-l-primary" : "border-l-accent"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute -top-3 -right-1 text-5xl font-extrabold ${
                      i % 2 === 0 ? "text-primary/10" : "text-accent/20"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="relative text-base font-semibold text-ink">{u.title}</h3>
                  <p className="relative mt-1.5 text-sm text-ink-muted">{u.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* How it works — Features/Use cases와 세 번째로 똑같은 카드 그리드가
            반복되지 않도록, 카드 사이에 PainPointPromo와 같은 점선 화살표를
            둬서 "이어지는 순서"라는 느낌을 시각적으로 준다. */}
        <section className="w-full px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-xs font-bold tracking-wide text-primary">이용 방법</span>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                3단계로 시작하세요
              </h2>
            </div>
            <div className="grid w-full grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:gap-3">
              {STEPS.map((s, i) => (
                <Fragment key={s.title}>
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-hairline bg-surface p-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                      {i + 1}
                    </div>
                    <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                    <p className="text-sm text-ink-muted">{s.desc}</p>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="hidden justify-center sm:flex">
                      <StepArrow />
                    </div>
                  )}
                </Fragment>
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
          <span>© 2026 이지서치. All rights reserved.</span>
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
            <Link href="/keywords" className="hover:text-primary">
              업종별 키워드
            </Link>
            <Link href="/board" className="hover:text-primary">
              게시판
            </Link>
            <Link href="/policy-board" className="hover:text-primary">
              소상공인 정책정보
            </Link>
            <Link href="/blog-type" className="hover:text-primary">
              유형 진단
            </Link>
            <Link href="/guide" className="hover:text-primary">
              가이드
            </Link>
            <Link href="/mypage" className="hover:text-primary">
              내 정보
            </Link>
            <Link href="/contact" className="hover:text-primary">
              문의하기
            </Link>
            <Link href="/privacy" className="hover:text-primary">
              개인정보처리방침
            </Link>
            <Link href="/terms" className="hover:text-primary">
              이용약관
            </Link>
          </div>
        </div>
      </footer>

      <MobileStickyCta href="#hero-search" label="키워드 검색하기" />
    </div>
  );
}
