import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getPolicyPosts, type PolicyCategory } from "@/lib/notion/policyBoard";
import { POLICY_CATEGORY } from "@/lib/notion/schema";
import { formatKstDateTime } from "@/lib/utils/formatDate";

export const metadata: Metadata = {
  title: "소상공인 정책정보",
  description: "대출정보·정부지원금·공모전·소상공인뉴스를 기업마당 공식 데이터로 매일 자동 업데이트해요.",
};

export const dynamic = "force-dynamic";

const CATEGORY_TABS = [
  { label: "전체", value: undefined },
  { label: POLICY_CATEGORY.loan, value: POLICY_CATEGORY.loan },
  { label: POLICY_CATEGORY.subsidy, value: POLICY_CATEGORY.subsidy },
  { label: POLICY_CATEGORY.contest, value: POLICY_CATEGORY.contest },
  { label: POLICY_CATEGORY.news, value: POLICY_CATEGORY.news },
] as const;

// /board/page.tsx의 이전/다음 커서 스택 패턴 그대로(§CLAUDE.md 신규 섹션) —
// 카테고리 필터도 같이 실어서 넘김.
function buildHref(cursor: string, prevCursors: string[], category?: string): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (prevCursors.length > 0) params.set("prev", prevCursors.join(","));
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/policy-board?${qs}` : "/policy-board";
}

export default async function PolicyBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; prev?: string; category?: string }>;
}) {
  const { cursor, prev, category } = await searchParams;
  const validCategory = (Object.values(POLICY_CATEGORY) as string[]).includes(category ?? "")
    ? (category as PolicyCategory)
    : undefined;
  const prevCursors = prev ? prev.split(",") : [];
  const { posts, nextCursor } = await getPolicyPosts(cursor, validCategory);

  const pageNumber = prevCursors.length + 1;
  const prevHref =
    prevCursors.length > 0
      ? buildHref(prevCursors[prevCursors.length - 1], prevCursors.slice(0, -1), validCategory)
      : null;
  const nextHref = nextCursor ? buildHref(nextCursor, [...prevCursors, cursor ?? ""], validCategory) : null;

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex w-full max-w-2xl flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">소상공인 정책정보</h1>
          <p className="text-sm text-ink-muted">
            대출정보·정부지원금·공모전·소상공인뉴스를 기업마당(bizinfo.go.kr) 공식 데이터로 매일 자동 업데이트해요.
          </p>
        </div>

        <div className="flex w-full max-w-2xl flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <Link
              key={tab.label}
              href={buildHref("", [], tab.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                validCategory === tab.value
                  ? "bg-primary text-white"
                  : "border border-hairline text-ink-muted hover:border-primary hover:text-primary"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex w-full max-w-2xl flex-col gap-2">
          {posts.length === 0 ? (
            <p className="rounded-lg border-2 border-dashed border-hairline bg-surface p-8 text-center text-sm text-ink-muted">
              아직 등록된 공고가 없어요. 매일 아침 자동으로 채워져요.
            </p>
          ) : (
            posts.map((post) => (
              <Link
                key={post.id}
                href={`/policy-board/${post.id}`}
                className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition hover:border-primary"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-ink-muted">
                    {post.category || "소상공인뉴스"}
                  </span>
                  {post.commentCount > 0 && (
                    <span className="text-xs font-semibold text-primary">[{post.commentCount}]</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-ink">{post.title}</p>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <span>{post.organization || "기업마당"}</span>
                  <span>·</span>
                  <span>{formatKstDateTime(post.postedAt)}</span>
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
