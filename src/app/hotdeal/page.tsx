import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getHotdealPosts } from "@/lib/notion/hotdeal";

export const metadata: Metadata = {
  title: "핫딜정보",
  description: "회원들이 직접 등록한 최저가 정보를 모델명으로 검색해보세요.",
};

export const dynamic = "force-dynamic";

// /board·/policy-board와 동일한 이전/다음 커서 스택 페이지네이션(§CLAUDE.md
// 20) — 모델명 검색어도 같이 실어서 넘김.
function buildHref(cursor: string, prevCursors: string[], q?: string): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (prevCursors.length > 0) params.set("prev", prevCursors.join(","));
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/hotdeal?${qs}` : "/hotdeal";
}

export default async function HotdealPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; prev?: string; q?: string }>;
}) {
  const { cursor, prev, q } = await searchParams;
  const prevCursors = prev ? prev.split(",") : [];
  const { posts, nextCursor } = await getHotdealPosts(cursor, q?.trim() || undefined);

  const pageNumber = prevCursors.length + 1;
  const prevHref =
    prevCursors.length > 0
      ? buildHref(prevCursors[prevCursors.length - 1], prevCursors.slice(0, -1), q)
      : null;
  const nextHref = nextCursor ? buildHref(nextCursor, [...prevCursors, cursor ?? ""], q) : null;

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex w-full max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">핫딜정보</h1>
            <p className="mt-1 text-sm text-ink-muted">회원들이 직접 등록한 최저가 정보예요. 모델명으로 검색해보세요.</p>
          </div>
          <Link
            href="/hotdeal/write"
            className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            핫딜 등록
          </Link>
        </div>

        <form action="/hotdeal" className="flex w-full max-w-2xl gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="모델명으로 검색 (예: 갤럭시버즈3)"
            className="h-11 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-md border border-hairline px-4 text-sm font-semibold text-ink transition hover:bg-bg"
          >
            검색
          </button>
        </form>

        <div className="flex w-full max-w-2xl flex-col gap-2">
          {posts.length === 0 ? (
            <p className="rounded-lg border-2 border-dashed border-hairline bg-surface p-8 text-center text-sm text-ink-muted">
              {q ? "검색 결과가 없어요." : "아직 등록된 핫딜이 없어요. 첫 핫딜을 등록해보세요!"}
            </p>
          ) : (
            posts.map((post) => (
              <Link
                key={post.id}
                href={`/hotdeal/${post.id}`}
                className="flex items-center gap-3 rounded-lg border border-hairline bg-surface p-4 transition hover:border-primary"
              >
                {post.thumbnailUrl ? (
                  // 외부(루리웹) 썸네일이라 next/image remotePatterns 설정 없이 그대로 씀
                  // (§CLAUDE.md 18.3의 board 이미지와 같은 패턴)
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.thumbnailUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-md border border-hairline object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-md border border-hairline bg-bg" aria-hidden />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-ink-muted">{post.modelName}</span>
                    {post.commentCount > 0 && (
                      <span className="text-xs font-semibold text-primary">[{post.commentCount}]</span>
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold text-ink">{post.title}</p>
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    {post.lowestPrice != null && (
                      <span className="font-semibold text-primary">{post.lowestPrice.toLocaleString()}원~</span>
                    )}
                    <span>{post.authorNickname || "익명"}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {(prevHref || nextHref) && (
          <div className="flex w-full max-w-2xl items-center justify-center gap-4">
            {prevHref ? (
              <Link href={prevHref} className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-bg">
                ← 이전
              </Link>
            ) : (
              <span className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink-muted/40">← 이전</span>
            )}
            <span className="text-sm text-ink-muted">{pageNumber}페이지</span>
            {nextHref ? (
              <Link href={nextHref} className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-bg">
                다음 →
              </Link>
            ) : (
              <span className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink-muted/40">다음 →</span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
