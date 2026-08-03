import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import PostBody from "@/components/board/PostBody";
import CommentSection from "@/components/board/CommentSection";
import { getBoardPost, getCommentsForPost } from "@/lib/notion/board";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const post = await getBoardPost(postId);
  return { title: post?.title ?? "게시글" };
}

export default async function BoardPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const [post, comments, user] = await Promise.all([
    getBoardPost(postId),
    getCommentsForPost(postId),
    getCurrentUser(),
  ]);

  if (!post) notFound();

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <article className="flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-1 border-b border-hairline pb-3">
            <h1 className="text-xl font-bold text-ink">{post.title}</h1>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span>{post.authorNickname || "익명"}</span>
            </div>
          </div>
          <PostBody postId={post.id} body={post.body} />
        </article>

        <div className="w-full max-w-2xl">
          <CommentSection
            postId={post.id}
            initialComments={comments}
            loggedIn={!!user}
            needsNickname={!!user && !user.nickname}
          />
        </div>
      </main>
    </div>
  );
}
