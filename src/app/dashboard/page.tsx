import BlogScoreForm from "@/components/dashboard/BlogScoreForm";
import PainPointPromo from "@/components/PainPointPromo";
import AmbientParticles from "@/components/AmbientParticles";
import Link from "next/link";

export default function DashboardHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center">
      {/* Hero + form */}
      <section className="relative flex w-full flex-col items-center gap-6 overflow-hidden px-4 py-24 text-center sm:px-6 sm:py-32">
        <AmbientParticles />
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

        <BlogScoreForm />
      </section>

      <PainPointPromo
        heading="이런 고민, 블로그지수가 해결해드려요"
        points={[
          {
            question: "내 블로그가 경쟁사보다 잘 하고 있는지 모르겠어요.",
            title: "블로그지수로 한눈에 비교",
            points: [
              "콘텐츠량·키워드 커버리지 등 6개 지표를 자동으로 진단",
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

      <footer className="w-full border-t border-hairline bg-bg px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 text-xs text-ink-muted sm:flex-row">
          <span>© 2026 easySerch. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-primary">
              키워드 검색량
            </Link>
            <Link href="/dashboard" className="hover:text-primary">
              블로그지수
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
