import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import AuthForms from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// 전용 로그인 페이지(§CLAUDE.md 22, 사용자 요청 — "타 사이트를 벤치마킹 해서
// ID PW 기입이 있고 아래 간편 로그인을 달아주는 형태로"). AuthForms.tsx가
// ID/PW 폼 + 소셜 버튼을 이미 다 가지고 있어서 이 페이지는 그걸 감싸는
// 얇은 레이아웃일 뿐 — 게시판/AI 글쓰기 등 4곳의 인라인 임베드와 로직을
// 공유해서 두 군데를 따로 유지보수할 필요가 없음.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const user = await getCurrentUser();
  const { redirect: redirectTo } = await searchParams;
  if (user) {
    redirect(redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/write");
  }

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">로그인</h1>
          <p className="text-sm text-ink-muted">이지서치의 게시판·AI 글쓰기 기능을 이용하려면 로그인해 주세요.</p>
        </div>
        <AuthForms />
      </main>
    </div>
  );
}
