"use client";

import { useState } from "react";
import Link from "next/link";

// 2026-08 재설계(1단계) — 홈 Hero의 타겟 3버튼. 세 타겟(소상공인·프리랜서·
// 블로거)은 서로 다른 제품이 필요한 게 아니라 같은 성장 루프에 다른 문으로
// 들어온다는 재설계 원칙(§청사진 2절)을 첫 화면에서 구현: 버튼을 고르면
// 바로 아래 한 줄 가치 제안과 보조 링크가 그 타겟의 언어로 바뀜.
// 진단 입력 폼 자체는 페이지(서버) 쪽에 있고 여기는 카피 전환만 담당.
type Persona = {
  id: string;
  label: string;
  headline: string;
  desc: string;
  secondaryHref: string;
  secondaryLabel: string;
};

const PERSONAS: Persona[] = [
  {
    id: "owner",
    label: "🏪 가게를 운영해요",
    headline: "우리 가게, 네이버에서 검색하면 나올까요?",
    desc: "가게 이름과 블로그 주소만 넣으면 플레이스 노출과 블로그지수를 한 번에 진단해드려요.",
    secondaryHref: "/policy-board",
    secondaryLabel: "지원금·정책 공고 보기",
  },
  {
    id: "freelancer",
    label: "💼 프리랜서예요",
    headline: "블로그가 곧 포트폴리오이자 영업이죠.",
    desc: "뭘 쓸지 키워드 데이터로 정하고, 내 블로그가 잘 크고 있는지 숫자로 확인하세요.",
    secondaryHref: "/write",
    secondaryLabel: "AI 자동글쓰기 소식 받기",
  },
  {
    id: "blogger",
    label: "✍️ 블로거예요",
    headline: "열심히 쓰는데 노출이 안 되나요?",
    desc: "블로그지수·경쟁 블로그 비교·키워드 노출 순위를 무료로 진단해보세요.",
    secondaryHref: "/trending",
    secondaryLabel: "요즘 뜨는 검색어 보기",
  },
];

export default function PersonaTabs() {
  const [activeId, setActiveId] = useState(PERSONAS[0].id);
  const active = PERSONAS.find((p) => p.id === activeId) ?? PERSONAS[0];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-2">
        {PERSONAS.map((persona) => (
          <button
            key={persona.id}
            type="button"
            onClick={() => setActiveId(persona.id)}
            aria-pressed={persona.id === activeId}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ease-spring motion-safe:active:scale-[0.97] ${
              persona.id === activeId
                ? "bg-primary text-white"
                : "border border-hairline bg-surface text-ink-muted hover:border-primary hover:text-primary"
            }`}
          >
            {persona.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-base font-semibold text-ink sm:text-lg">{active.headline}</p>
        <p className="max-w-md text-sm text-ink-muted">
          {active.desc}{" "}
          <Link href={active.secondaryHref} className="font-medium text-primary hover:underline">
            {active.secondaryLabel} →
          </Link>
        </p>
      </div>
    </div>
  );
}
