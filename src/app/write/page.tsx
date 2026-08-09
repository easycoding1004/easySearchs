import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import AuthForms from "@/components/AuthForms";
import BlogWriterForm, { type InitialStyleDefaults, type LayoutPreset } from "@/components/write/BlogWriterForm";
import SpeedyWritePromo from "@/components/write/SpeedyWritePromo";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminAuthed } from "@/lib/auth/adminAuth";
import { canUseWrite } from "@/lib/notion/users";
import { getWriteHistoryForUser } from "@/lib/notion/writeHistory";

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
