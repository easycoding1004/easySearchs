import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import HotdealThumbnail from "@/components/hotdeal/HotdealThumbnail";
import CursorPageNav from "@/components/CursorPageNav";
import { getHotdealPosts } from "@/lib/notion/hotdeal";
import { HOTDEAL_ENABLED } from "@/lib/constants";

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
  // 2026-08 재설계 — 노출 종료(HOTDEAL_ENABLED, constants.ts 참고).
  if (!HOTDEAL_ENABLED) notFound();

  const { cursor, prev, q } = await searchParams;
  // 버그 수정 — board/page.tsx와 동일한 이유(prev="" vs prev 없음을
  // 구분해야 함, 실측 확인).
  const prevCursors = prev !== undefined ? prev.split(",") : [];
  const { posts, nextCursor } = await getHotdealPosts(cursor, q?.trim() || undefined);

  const pageNumber = prevCursors.length + 1;
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

        {posts.length === 0 ? (
          <p className="w-full max-w-2xl rounded-lg border-2 border-dashed border-hairline bg-surface p-8 text-center text-sm text-ink-muted">
            {q ? "검색 결과가 없어요." : "아직 등록된 핫딜이 없어요. 첫 핫딜을 등록해보세요!"}
          </p>
        ) : (
          // 2026-08 게시판(§CLAUDE.md 18.5)과 목록 골격을 통일함 — 카드 나열식
          // 대신 표로 스캔 방식을 맞춤(제품 감사에서 발견한 화면 불일치 항목).
          // 썸네일은 그대로 살려서 표 첫 칸에 넣음.
          <div className="w-full max-w-2xl overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs text-ink-muted">
                  <th className="w-16 px-3 py-2 text-left font-medium"></th>
                  <th className="px-3 py-2 text-left font-medium">제목</th>
                  <th className="w-24 px-3 py-2 text-right font-medium">최저가</th>
                  <th className="w-20 px-3 py-2 text-left font-medium sm:w-24">작성자</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-hairline last:border-0 transition hover:bg-bg">
                    <td className="px-3 py-2.5">
                      <HotdealThumbnail src={post.thumbnailUrl} alt="" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/hotdeal/${post.id}`} className="block truncate font-medium text-ink hover:text-primary">
                        <span className="mr-1.5 rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-ink-muted">
                          {post.modelName}
                        </span>
                        {post.title}
                        {post.commentCount > 0 && <span className="ml-1 font-normal text-primary">[{post.commentCount}]</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-primary">
                      {post.lowestPrice != null ? `${post.lowestPrice.toLocaleString()}원` : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{post.authorNickname || "익명"}</td>
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
          buildHref={(c, p) => buildHref(c, p, q)}
        />
      </main>
    </div>
  );
}
