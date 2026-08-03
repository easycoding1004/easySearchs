import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import AuthForms from "@/components/AuthForms";
import BoardPostForm from "@/components/board/BoardPostForm";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "글쓰기",
  description: "이지서치 게시판에 새 글을 남겨보세요.",
};

export const dynamic = "force-dynamic";

// /write/page.tsx와 같은 게이트 패턴(§CLAUDE.md 16) — 로그인한 회원만 작성
// 폼을 보고, 아니면 공용 로그인 폼(AuthForms)을 보여줌.
export default async function BoardWritePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">게시판 글쓰기</h1>
        </div>

        {user && user.emailVerified ? (
          <BoardPostForm needsNickname={!user.nickname} />
        ) : (
          <Suspense>
            <AuthForms />
          </Suspense>
        )}
      </main>
    </div>
  );
}
