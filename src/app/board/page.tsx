import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import CursorPageNav from "@/components/CursorPageNav";
import { getBoardPosts, getPinnedBoardPosts, BOARD_PAGE_SIZE, type BoardPost } from "@/lib/notion/board";

export const metadata: Metadata = {
  title: "게시판",
  description: "이지서치 사용법을 묻고 답하는 게시판 — 누구나 읽을 수 있고, 회원가입하면 질문·답변을 남길 수 있어요.",
};

export const dynamic = "force-dynamic";

// 2026-08 게시판(§CLAUDE.md 16) — 읽기는 로그인 없이 완전히 공개(개인
// 도구/블로그지수와 같은 원칙), 쓰기만 회원 전용.
// 2026-08 포지셔닝 조정(사용자 요청) — 범용 자유게시판보다 "이지서치
// 사용법 Q&A"에 가깝게 문구를 다듬음(실제로 시드/실사용 게시글 대부분이
// 이런 성격이라 §CLAUDE.md 18에도 같은 관찰이 적혀 있음). 자유롭게 다른
// 글도 쓸 수 있는 기능 자체는 그대로 유지 — 프레이밍만 바꿈.
//
// 2026-08 추가(사용자 요청 — "페이징 기능") — Notion 데이터소스 쿼리는
// 커서 기반이라(오프셋/임의 페이지 점프 불가) "1 2 3 4 5" 같은 숫자
// 페이지네이션은 만들 수 없음 — 대신 이전 페이지들의 진입 커서를 URL의
// `prev` 파라미터에 스택으로 쌓아서(쉼표 구분, 빈 문자열 = 1페이지)
// "이전/다음"을 양방향으로 오갈 수 있게 함. 서버 상태 없이 URL만으로
// 페이지 위치가 정해져서 새로고침·공유·북마크에도 안전함.
function buildBoardHref(cursor: string, prevCursors: string[]): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (prevCursors.length > 0) params.set("prev", prevCursors.join(","));
  const qs = params.toString();
  return qs ? `/board?${qs}` : "/board";
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; prev?: string }>;
}) {
  const { cursor, prev } = await searchParams;
  // 2026-08 버그 수정(실측 확인) — prev 파라미터가 빈 문자열("")인 경우와
  // 아예 없는 경우를 구분해야 함. 페이지 1의 커서는 원래 없어서 빈
  // 문자열("")로 스택에 쌓이는데(다음 페이지로 넘어갈 때 [...prevCursors,
  // cursor ?? ""]), 그 빈 문자열 하나만 있는 상태가 URL로는 `prev=`(빈
  // 값)로 직렬화됨 — `prev`가 JS에서 falsy라 `prev ? ... : []`로 파싱하면
  // "파라미터 자체가 없음"과 구분이 안 돼 [] 로 잘못 읽혀서, 페이지 2가
  // "1페이지"로 잘못 표시되고 이전 버튼도 사라지는 버그가 있었음(숫자
  // 페이지네이션을 붙이면서 실제로 재현·확인함). undefined 여부로 구분.
  const prevCursors = prev !== undefined ? prev.split(",") : [];
  const [pinned, { posts, nextCursor }] = await Promise.all([
    // 공지 목록 로드가 실패해도 일반 목록은 그대로 보여야 함 — 부가 섹션이라
    // 핵심 기능(게시글 목록)을 막지 않음.
    getPinnedBoardPosts().catch(() => []),
    getBoardPosts(cursor),
  ]);

  const pageNumber = prevCursors.length + 1;
  const nextHref = nextCursor ? buildBoardHref(nextCursor, [...prevCursors, cursor ?? ""]) : null;
  // 번호는 페이지를 넘길수록 이어지는 "몇 번째 글" 느낌으로 — 공지는 번호
  // 매김 대상이 아니라서 이 계산에서 제외.
  const startIndex = (pageNumber - 1) * BOARD_PAGE_SIZE;

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex w-full max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">게시판</h1>
            <p className="mt-1 text-sm text-ink-muted">
              이지서치 사용법이 궁금하신가요? 다른 분들의 질문과 답변을 둘러보세요.
            </p>
          </div>
          <Link
            href="/board/write"
            className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            글쓰기
          </Link>
        </div>

        {posts.length === 0 && pinned.length === 0 ? (
          <p className="w-full max-w-2xl rounded-lg border-2 border-dashed border-hairline bg-surface p-8 text-center text-sm text-ink-muted">
            아직 게시글이 없어요. 첫 글을 남겨보세요!
          </p>
        ) : (
          <div className="w-full max-w-2xl overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs text-ink-muted">
                  <th className="w-14 px-3 py-2 text-center font-medium">번호</th>
                  <th className="px-3 py-2 text-left font-medium">제목</th>
                  <th className="w-24 px-3 py-2 text-left font-medium sm:w-28">작성자</th>
                </tr>
              </thead>
              <tbody>
                {pinned.map((post) => (
                  <BoardRow key={post.id} post={post} numberCell={<span className="font-semibold text-primary">공지</span>} pinned />
                ))}
                {posts.map((post, i) => (
                  <BoardRow key={post.id} post={post} numberCell={startIndex + i + 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <CursorPageNav
          pageNumber={pageNumber}
          prevCursors={prevCursors}
          nextHref={nextHref}
          buildHref={buildBoardHref}
        />
      </main>
    </div>
  );
}

function BoardRow({
  post,
  numberCell,
  pinned = false,
}: {
  post: BoardPost;
  numberCell: React.ReactNode;
  pinned?: boolean;
}) {
  return (
    <tr className={`border-b border-hairline last:border-0 transition hover:bg-bg ${pinned ? "bg-primary/5" : ""}`}>
      <td className="px-3 py-2.5 text-center text-ink-muted">{numberCell}</td>
      <td className="px-3 py-2.5">
        <Link href={`/board/${post.id}`} className="block truncate font-medium text-ink hover:text-primary">
          {post.title}
          {post.commentCount > 0 && <span className="ml-1 font-normal text-primary">[{post.commentCount}]</span>}
        </Link>
      </td>
      <td className="px-3 py-2.5 text-ink-muted">{post.authorNickname || "익명"}</td>
    </tr>
  );
}
