import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import AuthForms from "@/components/write/AuthForms";
import BlogWriterForm from "@/components/write/BlogWriterForm";
import { getCurrentUser } from "@/lib/write/auth";
import { hasUsedToday } from "@/lib/notion/users";

export const metadata: Metadata = {
  title: "AI 블로그 글쓰기",
  description: "사진과 프롬프트만 입력하면 네이버 블로그에 바로 쓸 수 있는 글을 AI가 완성해드려요.",
};

export const dynamic = "force-dynamic";

export default async function WritePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            AI 블로그 글쓰기
          </h1>
          <p className="max-w-md text-sm text-ink-muted">
            사진과 프롬프트만 입력하면 네이버 블로그에 바로 붙여넣을 수 있는 글을 완성해드려요.
          </p>
        </div>

        {user && user.emailVerified ? (
          <BlogWriterForm email={user.email} hasUsedToday={hasUsedToday(user)} />
        ) : (
          <AuthForms />
        )}
      </main>
    </div>
  );
}
