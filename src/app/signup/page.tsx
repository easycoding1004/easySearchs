import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SignupForm from "@/components/SignupForm";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "회원가입",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// 전용 회원가입 페이지(§CLAUDE.md 22) — 이메일+비밀번호 가입 전용. 소셜
// 로그인으로 처음 가입하는 흐름은 여전히 /signup/agree(별도 페이지, OAuth
// 콜백 이후에만 도달 가능)가 담당 — 이 페이지는 그 경로를 대체하지 않고
// 이메일+비밀번호 전용 신규 진입점만 추가함.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const user = await getCurrentUser();
  const { redirect: redirectTo } = await searchParams;
  if (user) {
    redirect(redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/");
  }

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-16 sm:px-6 sm:py-20">
        <SignupForm />
      </main>
    </div>
  );
}
