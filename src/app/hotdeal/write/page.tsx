import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import AuthForms from "@/components/AuthForms";
import HotdealPostForm from "@/components/hotdeal/HotdealPostForm";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "핫딜 등록",
  description: "직접 찾은 최저가 정보를 다른 사람들과 나눠보세요.",
};

export const dynamic = "force-dynamic";

// board/write/page.tsx와 같은 게이트 패턴(§CLAUDE.md 20) — 로그인한 회원만
// 작성 폼을 보고, 아니면 공용 로그인 폼(AuthForms)을 보여줌.
export default async function HotdealWritePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">핫딜 등록</h1>
          <p className="max-w-md text-sm text-ink-muted">직접 찾은 최저가 정보를 쇼핑몰별로 비교해서 등록해보세요.</p>
        </div>

        {user && user.emailVerified ? (
          <HotdealPostForm needsNickname={!user.nickname} />
        ) : (
          <Suspense>
            <AuthForms />
          </Suspense>
        )}
      </main>
    </div>
  );
}
