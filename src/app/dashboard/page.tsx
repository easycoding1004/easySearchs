import type { Metadata } from "next";
import BlogScoreForm from "@/components/dashboard/BlogScoreForm";
import SampleResultPreview from "@/components/dashboard/SampleResultPreview";
import PainPointPromo from "@/components/PainPointPromo";
import AmbientParticles from "@/components/AmbientParticles";
import Reveal from "@/components/Reveal";
import MobileStickyCta from "@/components/MobileStickyCta";
import { RADAR_AXES } from "@/lib/dashboard/contentDiagnostics";
import Link from "next/link";

export const metadata: Metadata = {
  title: "블로그지수",
  description: "내 블로그와 경쟁 블로그 주소, 키워드만 입력하면 블로그지수와 경쟁사 노출을 무료로 비교해드려요.",
};

export default function DashboardHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center">
      {/* Hero + form */}
      <section
        id="hero-form"
        className="flex w-full flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32"
      >
        <div className="relative isolate mx-auto flex w-full max-w-2xl flex-col items-center gap-6 overflow-hidden py-4">
          <AmbientParticles />
          <div className="relative z-10 flex flex-col items-center gap-6">
            <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
              무료 · 회원가입 불필요
            </span>
            <div className="flex flex-col items-center gap-3">
              <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-6xl">
                <span className="text-primary">블로그지수</span>로 확인하세요
              </h1>
              <p className="max-w-md text-sm text-ink-muted sm:text-base">
                내 블로그와 경쟁 블로그 주소, 키워드만 입력하면 블로그지수와 경쟁사 노출을 바로
                확인할 수 있어요.
              </p>
            </div>
          </div>
        </div>

        <BlogScoreForm />
      </section>

      <section className="w-full border-t border-hairline bg-surface px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="mx-auto max-w-4xl">
          <SampleResultPreview />
        </Reveal>
      </section>

      <PainPointPromo
        heading="이런 고민, 블로그지수가 해결해드려요"
        points={[
          {
            question: "내 블로그가 경쟁사보다 잘 하고 있는지 모르겠어요.",
            title: "블로그지수로 한눈에 비교",
            points: [
              `콘텐츠량·키워드 커버리지 등 ${RADAR_AXES.length}개 지표를 자동으로 진단`,
              "점수로 환산해서 한눈에 비교",
              "경쟁 블로그 여러 곳과 동시에 비교 가능",
            ],
          },
          {
            question: "블로그를 어떻게 개선해야 할지 막막해요.",
            title: "무엇이 부족한지 알려드려요",
            points: [
              "경쟁사 대비 부족한 지표를 자동으로 감지",
              "구체적인 개선 방향까지 제안",
              "키워드 클러스터로 다음 글 소재까지 추천",
            ],
          },
        ]}
      />

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
            <Link href="/privacy" className="hover:text-primary">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </footer>

      <MobileStickyCta href="#hero-form" label="무료로 비교하기" />
    </main>
  );
}
