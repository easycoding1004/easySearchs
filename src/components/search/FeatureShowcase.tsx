"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

// 2026-08 추가 — 히어로 검색창 바로 아래 있던 CategoryTopKeywordsPanel(카테고리별
// 인기 검색어 탭)을 치우고 그 자리에 넣는 "3대 기능 쇼케이스"(사용자 요청, 3개
// 컨셉 중 "탭 전환형 단일 쇼케이스"를 선택함). 카테고리 패널이 하던 역할(업종별
// 인기 검색어 노출)은 `/keywords`가 그대로 맡고 있고 푸터 링크로도 계속
// 접근 가능하니 홈페이지 진입점만 줄어든 것 — 완전히 없어진 기능은 아님.
interface ShowcaseTab {
  id: string;
  label: string;
  tabIcon: ReactNode;
  title: string;
  steps: string[];
  ctaLabel: string;
  ctaHref: string;
  illustration: ReactNode;
  // AI 블로그 자동글쓰기만 로그인 필요(§CLAUDE.md 16) — CTA 버튼에 미리
  // 표시해서 눌렀다가 로그인 화면으로 튕기는 놀람을 줄임.
  membersOnly?: boolean;
}

function BarChartIllustration() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full" aria-hidden>
      <rect x="14" y="52" width="18" height="36" rx="4" className="fill-accent/30" />
      <rect x="42" y="30" width="18" height="58" rx="4" className="fill-primary" />
      <rect x="70" y="44" width="18" height="44" rx="4" className="fill-accent" />
      <rect x="98" y="14" width="8" height="74" rx="4" className="fill-primary/25" />
      <path
        d="M18 46 L48 24 L78 38 L102 10"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-success"
      />
      <circle cx="102" cy="10" r="4" className="fill-success" />
    </svg>
  );
}

function GaugeIllustration() {
  // 반원 게이지 — stroke-dasharray로 진행률(약 84%)만큼 채움.
  const radius = 42;
  const circumference = Math.PI * radius; // 반원 둘레
  const progress = 0.84;
  return (
    <svg viewBox="0 0 120 70" className="h-full w-full" aria-hidden>
      <path
        d="M10 60 A 42 42 0 0 1 110 60"
        fill="none"
        stroke="currentColor"
        strokeWidth={10}
        strokeLinecap="round"
        className="text-hairline"
      />
      <path
        d="M10 60 A 42 42 0 0 1 110 60"
        fill="none"
        stroke="currentColor"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${circumference * progress} ${circumference}`}
        className="text-primary"
      />
      <text x="60" y="52" textAnchor="middle" className="fill-ink text-[26px] font-bold">
        8.4
      </text>
    </svg>
  );
}

function SparkleDocIllustration() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full" aria-hidden>
      <rect x="20" y="10" width="60" height="80" rx="8" className="fill-surface stroke-hairline" strokeWidth={2} />
      <rect x="32" y="26" width="36" height="5" rx="2.5" className="fill-accent/40" />
      <rect x="32" y="38" width="36" height="5" rx="2.5" className="fill-primary/20" />
      <rect x="32" y="50" width="24" height="5" rx="2.5" className="fill-primary/20" />
      <rect x="32" y="62" width="36" height="5" rx="2.5" className="fill-primary/20" />
      <path
        d="M92 22 L96 32 L106 36 L96 40 L92 50 L88 40 L78 36 L88 32 Z"
        className="fill-accent"
      />
      <path d="M98 62 L100 68 L106 70 L100 72 L98 78 L96 72 L90 70 L96 68 Z" className="fill-primary" />
    </svg>
  );
}

const TABS: ShowcaseTab[] = [
  {
    id: "keyword",
    label: "키워드 검색량",
    tabIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />
      </svg>
    ),
    title: "궁금한 키워드, 3단계면 확인 끝",
    steps: [
      "키워드 입력 (콤마로 구분, 최대 5개)",
      "PC·모바일 검색량 + 연관 키워드 확인",
      "CSV로 저장하거나 블로그지수와 비교",
    ],
    ctaLabel: "지금 검색하기",
    ctaHref: "#hero-search",
    illustration: <BarChartIllustration />,
  },
  {
    id: "blogscore",
    label: "블로그지수",
    tabIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    title: "내 블로그, 지금 몇 점일까요?",
    steps: [
      "내 블로그 주소 입력 (비교 블로그는 선택, 최대 10개)",
      "노출순위·게시글수·댓글·공감·공유 5개 지표 종합 점수",
      "결과 URL로 공유하거나 이미지로 저장",
    ],
    ctaLabel: "블로그지수 확인하기",
    ctaHref: "/dashboard",
    illustration: <GaugeIllustration />,
  },
  {
    id: "write",
    label: "AI 블로그 자동글쓰기",
    tabIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" />
        <path d="M5 16l.8 1.9L7.7 18.7 5.8 19.5 5 21.4 4.2 19.5 2.3 18.7 4.2 17.9z" />
      </svg>
    ),
    title: "사진과 한 줄 프롬프트로 완성되는 글",
    steps: [
      "사진 업로드 + 프롬프트 입력, 16가지 글 유형 중 선택",
      "AI가 제목·본문·태그·추천 이미지까지 완성",
      "복사하거나 크롬 확장으로 자동 삽입 후 등록",
    ],
    ctaLabel: "AI 블로그 써보기",
    ctaHref: "/write",
    illustration: <SparkleDocIllustration />,
    membersOnly: true,
  },
];

// 기본 선택 탭 = 블로그지수(가운데) — 사용자 요청("블로그지수를 가운데 카드
// 형태로")을 탭 순서 2번째 + 기본 활성 탭으로 반영.
const DEFAULT_TAB_INDEX = 1;

export default function FeatureShowcase() {
  const [activeIndex, setActiveIndex] = useState(DEFAULT_TAB_INDEX);
  const active = TABS[activeIndex];

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap justify-center gap-2">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition ease-spring sm:text-sm ${
              i === activeIndex
                ? "bg-primary text-white"
                : "border border-hairline text-ink-muted hover:border-primary hover:text-primary"
            }`}
          >
            {tab.tabIcon}
            {tab.label}
          </button>
        ))}
      </div>

      <div key={active.id} className="showcase-fade-in flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="h-28 w-28 shrink-0 text-primary sm:h-32 sm:w-32">{active.illustration}</div>

        <div className="flex flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <h3 className="text-base font-bold text-ink sm:text-lg">{active.title}</h3>
          <ol className="flex flex-col gap-1.5">
            {active.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-2 text-sm text-ink-muted">
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-bg text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href={active.ctaHref}
            className="mt-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
          >
            {active.ctaLabel}
            {active.membersOnly && <span className="font-normal text-white/80"> (회원 전용)</span>}
          </Link>
        </div>
      </div>
    </div>
  );
}
