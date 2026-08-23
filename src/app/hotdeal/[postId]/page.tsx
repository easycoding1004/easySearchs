import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import CommentThread from "@/components/CommentThread";
import { getHotdealPost, getCommentsForHotdealPost } from "@/lib/notion/hotdeal";
import { getCurrentUser } from "@/lib/auth/session";
import { formatKstDateTime } from "@/lib/utils/formatDate";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const post = await getHotdealPost(postId);
  return { title: post?.title ?? "핫딜정보" };
}

export default async function HotdealPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const [post, comments, user] = await Promise.all([
    getHotdealPost(postId),
    getCommentsForHotdealPost(postId),
    getCurrentUser(),
  ]);

  if (!post) notFound();

  const sortedComparisons = [...post.comparisons].sort((a, b) => a.price - b.price);

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <article className="flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-2 border-b border-hairline pb-3">
            <span className="w-fit rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-ink-muted">{post.modelName}</span>
            <h1 className="text-xl font-bold text-ink">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span>{post.authorNickname || "익명"}</span>
              <span>·</span>
              <span>{formatKstDateTime(post.postedAt)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-ink">가격 비교</h2>
            <div className="flex flex-col gap-2">
              {sortedComparisons.map((entry, i) => (
                <a
                  key={`${entry.platform}-${i}`}
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={`flex items-center justify-between gap-3 rounded-md border p-3 text-sm transition hover:border-primary ${
                    i === 0 ? "border-primary bg-primary/5" : "border-hairline bg-bg"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">최저가</span>
                    )}
                    <span className="font-medium text-ink">{entry.platform}</span>
                  </span>
                  <span className="font-semibold text-primary">{entry.price.toLocaleString()}원 →</span>
                </a>
              ))}
            </div>
          </div>

          {post.body && <p className="whitespace-pre-wrap text-sm text-ink">{post.body}</p>}

          <p className="text-xs text-ink-muted">
            회원이 직접 등록한 정보예요. 실제 가격·재고는 구매 전 각 쇼핑몰에서 다시 한번 확인해 주세요.
          </p>
        </article>

        <div className="w-full max-w-2xl">
          <CommentThread
            board="hotdeal"
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
