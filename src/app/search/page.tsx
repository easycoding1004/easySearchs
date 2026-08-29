import type { Metadata } from "next";
import { Suspense } from "react";
import SearchForm from "@/components/search/SearchForm";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FeatureShowcase from "@/components/search/FeatureShowcase";
import AmbientParticles from "@/components/AmbientParticles";
import PainPointPromo from "@/components/PainPointPromo";
import MobileStickyCta from "@/components/MobileStickyCta";

export const metadata: Metadata = {
  title: "네이버 키워드 검색량 조회",
  description:
    "키워드를 입력하면 네이버 검색광고 API 기준 PC·모바일 검색량과 연관 키워드를 무료로 조회합니다. CSV 다운로드 지원.",
};

// 2026-08 재설계(1단계) — 키워드 검색량 조회가 홈(`/`) Hero에서 이 전용
// 페이지로 이동함. 홈은 "블로그 진단 입력"이 첫 훅이 되고(재설계 확정 사항),
// 키워드 조회는 성장 루프의 "계획" 단계 부품으로 재배치됨. SearchForm은
// /api/search → /result/[sessionId] 흐름 그대로라 호스트 페이지만 바뀐 것.
export default function SearchPage() {
  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />

      <main className="flex flex-1 flex-col items-center">
        <section className="flex w-full flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-24">
          <div className="relative isolate mx-auto flex w-full max-w-2xl flex-col items-center gap-6 overflow-hidden py-4">
            <AmbientParticles />
            <div className="relative z-10 flex flex-col items-center gap-6">
              <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
                무료 · 회원가입 불필요
              </span>
              <div className="flex flex-col items-center gap-3">
                <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
                  <span className="text-primary">네이버 키워드</span> 검색량 조회
                </h1>
                <p className="max-w-md text-sm text-ink-muted sm:text-base">
                  키워드를 입력하면 검색량(한 달 동안 이 단어를 검색한 횟수)과 연관 키워드를
                  무료로 조회합니다.
                </p>
              </div>
            </div>
          </div>

          <div id="search-form" className="flex w-full flex-col items-center gap-6">
            <div className="w-full max-w-xl">
              {/* useSearchParams(?q= 프리필) 때문에 Suspense 필요 — 없으면
                  이 페이지가 정적 생성에서 빠짐(BlogScoreForm과 동일 패턴). */}
              <Suspense>
                <SearchForm />
              </Suspense>
            </div>
            <div className="w-full max-w-xl">
              <FeatureShowcase />
            </div>
          </div>
        </section>

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
      </main>

      <SiteFooter />
      <MobileStickyCta href="#search-form" label="키워드 검색하기" />
    </div>
  );
}
