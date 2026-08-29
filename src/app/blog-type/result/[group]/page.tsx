import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ShareResultButton from "@/components/ShareResultButton";
import {
  GROUP_RESULTS,
  GROUP_SLUGS,
  groupFromSlug,
  getCategoriesForGroup,
} from "@/lib/blogType/quizData";
import { AI_WRITE_ENABLED } from "@/lib/constants";

// 2026-08 유입 전략(바이럴 장치) — 유형진단 결과의 공유 전용 페이지. 퀴즈
// 결과는 원래 클라이언트 상태에만 있어서 공유해도 받는 사람에게 밋밋한 기본
// OG 카드만 떴는데, 이 페이지가 생기면서 공유 링크마다 결과별 OG 카드
// (같은 폴더의 opengraph-image.tsx)가 붙고, 열어본 사람은 "나도 진단받기"
// CTA로 퀴즈에 진입함 — 공유가 곧 유입이 되는 루프. 4개 그룹뿐이라 빌드
// 타임에 전부 SSG됨.
export function generateStaticParams() {
  return Object.values(GROUP_SLUGS).map((slug) => ({ group: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ group: string }>;
}): Promise<Metadata> {
  const { group: slug } = await params;
  const group = groupFromSlug(slug);
  if (!group) return { title: "블로그 유형 진단" };
  const result = GROUP_RESULTS[group];
  return {
    title: `${result.headline} — 내 블로그 유형 진단`,
    description: `${result.description} 나는 어떤 유형일까? 4가지 질문, 30초면 확인할 수 있어요.`,
  };
}

export default async function BlogTypeResultPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group: slug } = await params;
  const group = groupFromSlug(slug);
  if (!group) notFound();

  const result = GROUP_RESULTS[group];
  const categories = getCategoriesForGroup(group);

  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-hairline bg-surface p-8 text-center">
          <span className="text-5xl">{result.emoji}</span>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">블로그 유형 진단 결과</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{result.headline}</h1>
          <p className="max-w-sm text-sm text-ink-muted">{result.description}</p>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-lg bg-primary p-6 text-center">
          <p className="text-base font-bold text-white">나는 어떤 유형일까?</p>
          <p className="text-sm text-white/85">4가지 질문에 답하면 30초 만에 알 수 있어요. 회원가입 없이 무료예요.</p>
          <Link
            href="/blog-type"
            className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-primary transition ease-spring hover:bg-white/90 motion-safe:active:scale-[0.97]"
          >
            나도 진단 받아보기 →
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink">이 유형에게 어울리는 글감</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categories.map((category) => (
              <div key={category.id} className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface p-4">
                <span className="text-sm font-semibold text-ink">{category.label}</span>
                <p className="text-xs text-ink-muted">{category.description}</p>
                <p className="mt-1 text-xs italic text-ink-muted">예: {category.sampleTitle}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ShareResultButton
            title={`나는 ${result.headline}! - 이지서치 블로그 유형 진단`}
            text={result.description}
          />
          {AI_WRITE_ENABLED ? (
            <Link
              href="/write"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
            >
              이 글감으로 AI가 바로 써드릴게요 →
            </Link>
          ) : (
            <Link
              href="/write"
              className="flex items-center gap-1.5 rounded-md border border-hairline px-4 py-2 text-sm font-medium text-ink-muted transition hover:text-primary"
            >
              AI 자동글쓰기 출시 알림 받기
            </Link>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
