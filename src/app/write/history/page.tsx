import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import AuthForms from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/auth/session";
import { getWriteHistoryForUser } from "@/lib/notion/writeHistory";
import { getBlogCategoryMeta } from "@/lib/write/blogCategories";
import { formatKstDateTime } from "@/lib/utils/formatDate";

export const metadata: Metadata = {
  title: "내 글쓰기 히스토리",
  description: "AI 블로그 자동글쓰기에서 실제로 확정해서 쓴 글의 이력을 확인해요.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// AI 글쓰기 히스토리(2026-08 추가, 사용자 요청 — "게시에 적용한 글들을
// 히스토리로 저장하고 싶어") — "이 버전으로 확정하기" 클릭마다 쌓인 본인
// 글만 볼 수 있는 개인 목록. 게시판(§CLAUDE.md 18)과 달리 완전히 비공개라
// robots noindex + 로그인 필수(비로그인은 AuthForms로 안내, redirect=이
// 경로로 자동 설정됨).
export default async function WriteHistoryPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex w-full max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">내 글쓰기 히스토리</h1>
            <p className="mt-1 text-sm text-ink-muted">
              실제로 확정해서 쓴 글의 이력이에요. 앞으로 글을 쓸 때 같은 유형의 최근 글을 문체 참고로 활용해요.
            </p>
          </div>
          <Link
            href="/write"
            className="shrink-0 rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-bg"
          >
            글쓰기로
          </Link>
        </div>

        {user && user.emailVerified ? (
          <WriteHistoryList userId={user.pageId} />
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center gap-3">
            <p className="text-center text-xs text-ink-muted">로그인하면 내 히스토리를 볼 수 있어요.</p>
            <AuthForms />
          </div>
        )}
      </main>
    </div>
  );
}

async function WriteHistoryList({ userId }: { userId: string }) {
  const entries = await getWriteHistoryForUser(userId);

  if (entries.length === 0) {
    return (
      <p className="w-full max-w-2xl rounded-lg border-2 border-dashed border-hairline bg-surface p-8 text-center text-sm text-ink-muted">
        아직 확정한 글이 없어요. 글을 완성하고 &quot;이 버전으로 확정하기&quot;를 누르면 여기 쌓여요.
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      {entries.map((entry) => {
        const meta = getBlogCategoryMeta(entry.category);
        return (
          <details key={entry.id} className="group rounded-lg border border-hairline bg-surface p-4">
            <summary className="flex cursor-pointer list-none flex-col gap-1">
              <p className="text-sm font-semibold text-ink">
                {entry.title}
                {entry.sponsored && <span className="ml-1 font-normal text-primary">협찬</span>}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span>{meta?.label ?? entry.category}</span>
                <span>{formatKstDateTime(entry.createdAt)}</span>
                {entry.tags.length > 0 && <span>{entry.tags.map((t) => `#${t}`).join(" ")}</span>}
              </div>
            </summary>
            <p className="mt-3 whitespace-pre-wrap border-t border-hairline pt-3 text-sm text-ink-muted">
              {entry.body}
            </p>
          </details>
        );
      })}
    </div>
  );
}
