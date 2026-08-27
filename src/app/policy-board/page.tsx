import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import CursorPageNav from "@/components/CursorPageNav";
import { getPolicyPosts, type PolicyCategory } from "@/lib/notion/policyBoard";
import { POLICY_CATEGORY } from "@/lib/notion/schema";

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
// 카테고리 필터·검색어도 같이 실어서 넘김.
function buildHref(cursor: string, prevCursors: string[], category?: string, q?: string): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (prevCursors.length > 0) params.set("prev", prevCursors.join(","));
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/policy-board?${qs}` : "/policy-board";
}

export default async function PolicyBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; prev?: string; category?: string; q?: string }>;
}) {
  const { cursor, prev, category, q } = await searchParams;
  const validCategory = (Object.values(POLICY_CATEGORY) as string[]).includes(category ?? "")
    ? (category as PolicyCategory)
    : undefined;
  const search = q?.trim() || undefined;
  // 버그 수정 — board/page.tsx와 동일한 이유(prev="" vs prev 없음을
  // 구분해야 함, 실측 확인).
  const prevCursors = prev !== undefined ? prev.split(",") : [];
  const { posts, nextCursor } = await getPolicyPosts(cursor, validCategory, search);

  const pageNumber = prevCursors.length + 1;
  const nextHref = nextCursor
    ? buildHref(nextCursor, [...prevCursors, cursor ?? ""], validCategory, search)
    : null;

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
              href={buildHref("", [], tab.value, search)}
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

        <form action="/policy-board" className="flex w-full max-w-2xl gap-2">
          {validCategory && <input type="hidden" name="category" value={validCategory} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="공고 제목으로 검색 (예: 대출, 청년, 공모전)"
            className="h-11 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-md border border-hairline px-4 text-sm font-semibold text-ink transition hover:bg-bg"
          >
            검색
          </button>
        </form>

        {posts.length === 0 ? (
          <p className="w-full max-w-2xl rounded-lg border-2 border-dashed border-hairline bg-surface p-8 text-center text-sm text-ink-muted">
            {search ? "검색 결과가 없어요." : "아직 등록된 공고가 없어요. 매일 아침 자동으로 채워져요."}
          </p>
        ) : (
          // 2026-08 게시판(§CLAUDE.md 18.5)과 목록 골격을 통일함 — 카드 나열식
          // 대신 표로 스캔 방식을 맞춤(제품 감사에서 발견한 화면 불일치 항목).
          <div className="w-full max-w-2xl overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs text-ink-muted">
                  <th className="w-20 px-3 py-2 text-left font-medium">카테고리</th>
                  <th className="px-3 py-2 text-left font-medium">제목</th>
                  <th className="w-28 px-3 py-2 text-left font-medium">기관</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-hairline last:border-0 transition hover:bg-bg">
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-ink-muted">
                        {post.category || "소상공인뉴스"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/policy-board/${post.id}`} className="block truncate font-medium text-ink hover:text-primary">
                        {post.title}
                        {post.commentCount > 0 && <span className="ml-1 font-normal text-primary">[{post.commentCount}]</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{post.organization || "기업마당"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <CursorPageNav
          pageNumber={pageNumber}
          prevCursors={prevCursors}
          nextHref={nextHref}
          buildHref={(c, p) => buildHref(c, p, validCategory, search)}
        />
      </main>
    </div>
  );
}
