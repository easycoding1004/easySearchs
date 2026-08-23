import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import CommentThread from "@/components/CommentThread";
import { getPolicyPost, getCommentsForPolicyPost } from "@/lib/notion/policyBoard";
import { getCurrentUser } from "@/lib/auth/session";
import { formatKstDateTime } from "@/lib/utils/formatDate";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPolicyPost(postId);
  return { title: post?.title ?? "소상공인 정책정보" };
}

export default async function PolicyBoardPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const [post, comments, user] = await Promise.all([
    getPolicyPost(postId),
    getCommentsForPolicyPost(postId),
    getCurrentUser(),
  ]);

  if (!post) notFound();

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <article className="flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-2 border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-ink-muted">
                {post.category || "소상공인뉴스"}
              </span>
              {post.deadline && (
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-on-brand">
                  마감 {formatKstDateTime(post.deadline)}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-ink">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span>{post.organization || "기업마당"}</span>
              <span>·</span>
              <span>{formatKstDateTime(post.postedAt)}</span>
            </div>
          </div>

          <p className="whitespace-pre-wrap text-sm text-ink">{post.body || "상세 내용은 원문 링크에서 확인해 주세요."}</p>

          {post.sourceUrl && (
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              기업마당 원문 보기 →
            </a>
          )}

          <p className="text-xs text-ink-muted">
            이 글은 기업마당(bizinfo.go.kr) 공식 데이터를 매일 자동으로 가져와 게시한 것으로, 정확한 신청 조건·마감일은 반드시 원문에서 확인해 주세요.
          </p>
        </article>

        <div className="w-full max-w-2xl">
          <CommentThread
            board="policy-board"
            postId={post.id}
            comments={comments}
            totalCount={post.commentCount}
            loggedIn={!!user}
            needsNickname={!!user && !user.nickname}
          />
        </div>
      </main>
    </div>
  );
}
