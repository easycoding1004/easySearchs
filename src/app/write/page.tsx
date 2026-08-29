import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import AuthForms from "@/components/AuthForms";
import BlogWriterForm, { type InitialStyleDefaults, type LayoutPreset } from "@/components/write/BlogWriterForm";
import SpeedyWritePromo from "@/components/write/SpeedyWritePromo";
import NewsletterSubscribeForm from "@/components/trending/NewsletterSubscribeForm";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminAuthed } from "@/lib/auth/adminAuth";
import { canUseWrite } from "@/lib/notion/users";
import { getWriteHistoryForUser } from "@/lib/notion/writeHistory";
import { AI_WRITE_ENABLED } from "@/lib/constants";

export const metadata: Metadata = {
  title: "AI 블로그 자동글쓰기",
  description: "사진과 프롬프트만 입력하면 네이버 블로그에 바로 쓸 수 있는 글을 AI가 완성해드려요.",
};

export const dynamic = "force-dynamic";

// 2026-08 추가(사용자 요청 — "게시에 적용한 글을 기반으로 앞으로 스타일을
// 미리 정해줬으면") — 가장 최근 히스토리 1건에서 스타일 설정을 뽑아 폼 초기값으로
// 넘김. 부가 기능이라 Notion 조회가 실패해도 페이지 렌더링 자체는 막지 않음
// (undefined를 반환하면 BlogWriterForm이 기존 하드코딩 기본값을 그대로 씀).
async function getInitialStyleDefaults(userId: string): Promise<InitialStyleDefaults | undefined> {
  try {
    const [latest] = await getWriteHistoryForUser(userId, { limit: 1 });
    if (!latest) return undefined;
    return {
      stylePreset: latest.stylePreset,
      layout: latest.layout as LayoutPreset,
      accentColor: latest.accentColor,
      font: latest.font,
    };
  } catch {
    return undefined;
  }
}

export default async function WritePage() {
  const [user, admin] = await Promise.all([getCurrentUser(), isAdminAuthed()]);

  // 2026-08 — 사용자 요청으로 AI 블로그 자동글쓰기를 임시로 "개발중" 처리
  // (AI_WRITE_ENABLED, src/lib/constants.ts). 관리자(/admin 비밀번호 쿠키)는
  // 이 사이트의 다른 기능들과 같은 원칙으로 계속 테스트·시연할 수 있게
  // 예외로 둠 — 일반 방문자만 이 안내 화면을 봄.
  // 2026-08 재설계(1단계) — "곧 출시" 막다른 안내 대신 출시 알림 이메일
  // 폼(리드 수집)을 배치. 저장소는 기존 뉴스레터 구독자 DB를 재사용하고,
  // 그 사실(뉴스레터로 소식 발송·수신 해지 가능)을 카피에 정직하게 밝힘.
  if (!AI_WRITE_ENABLED && !admin) {
    return (
      <div className="flex flex-1 flex-col items-center font-sans">
        <SiteHeader />
        <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
          <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-on-brand">출시 준비 중</span>
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">AI 블로그 자동글쓰기</h1>
            <p className="max-w-md text-sm text-ink-muted">
              사진과 프롬프트만 입력하면 네이버 블로그에 바로 붙여넣을 수 있는 글을 AI가
              완성해드리는 기능이에요. 지금 마지막 점검 중이에요.
            </p>
          </div>
          <div className="w-full max-w-md">
            <NewsletterSubscribeForm
              title="출시하면 이메일로 알려드릴게요"
              description="이지서치 뉴스레터로 출시 소식과 급상승 키워드 요약을 보내드려요. 언제든 수신 거부할 수 있어요."
              buttonLabel="출시 알림 받기"
              successTitle="신청 완료!"
              successDescription="AI 자동글쓰기가 출시되면 이메일로 가장 먼저 알려드릴게요."
            />
          </div>
        </main>
      </div>
    );
  }

  const initialStyleDefaults = user ? await getInitialStyleDefaults(user.pageId) : undefined;

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-20">
        <SpeedyWritePromo />

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            AI 블로그 자동글쓰기
          </h1>
          <p className="max-w-md text-sm text-ink-muted">
            사진과 프롬프트만 입력하면 네이버 블로그에 바로 붙여넣을 수 있는 글을 완성해드려요.
          </p>
        </div>

        {user && user.emailVerified ? (
          <>
            <Link href="/write/history" className="text-xs font-semibold text-primary hover:underline">
              내 히스토리 보기 →
            </Link>
            <BlogWriterForm
              email={user.email}
              blockedReason={admin ? null : canUseWrite(user).reason}
              isAdmin={admin}
              naverBlogId={user.naverBlogId}
              initialStyleDefaults={initialStyleDefaults}
            />
          </>
        ) : (
          <Suspense>
            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              <p className="text-center text-xs text-ink-muted">
                AI 블로그 자동글쓰기는 유료 API를 사용해서 무료 회원은 누적 3회까지 이용할 수 있어요.
                구독하면 매달 더 쓸 수 있어요.
              </p>
              <AuthForms />
            </div>
          </Suspense>
        )}
      </main>
    </div>
  );
}
