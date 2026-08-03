import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getBoardPosts } from "@/lib/notion/board";
import { stripPostBodyPreview } from "@/lib/board/parsePost";

export const metadata: Metadata = {
  title: "게시판",
  description: "이지서치 자유게시판 — 누구나 읽을 수 있고, 회원가입하면 글과 댓글을 남길 수 있어요.",
};

export const dynamic = "force-dynamic";

// 2026-08 게시판(§CLAUDE.md 16) — 읽기는 로그인 없이 완전히 공개(개인
// 도구/블로그지수와 같은 원칙), 쓰기만 회원 전용.
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const { posts, nextCursor } = await getBoardPosts(cursor);

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex w-full max-w-2xl items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">게시판</h1>
          <Link
            href="/board/write"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            글쓰기
          </Link>
        </div>

        <div className="flex w-full max-w-2xl flex-col gap-2">
          {posts.length === 0 ? (
            <p className="rounded-lg border-2 border-dashed border-hairline bg-surface p-8 text-center text-sm text-ink-muted">
              아직 게시글이 없어요. 첫 글을 남겨보세요!
            </p>
          ) : (
            posts.map((post) => (
              <Link
                key={post.id}
                href={`/board/${post.id}`}
                className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition hover:border-primary"
              >
                <p className="text-sm font-semibold text-ink">
                  {post.title}
                  {post.commentCount > 0 && (
                    <span className="ml-1 font-normal text-primary">[{post.commentCount}]</span>
                  )}
                </p>
                <p className="text-xs text-ink-muted">{stripPostBodyPreview(post.body)}</p>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <span>{post.authorNickname || "익명"}</span>
                </div>
              </Link>
            ))
          )}
        </div>

        {nextCursor && (
          <Link
            href={`/board?cursor=${encodeURIComponent(nextCursor)}`}
            className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-bg"
          >
            더 보기
          </Link>
        )}
      </main>
    </div>
  );
}
