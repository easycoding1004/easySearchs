import Link from "next/link";

// 2026-08 추가(사용자 요청 — "페이징을 1,2,3,4,5,6,7,8,9,>> 형태로") —
// /board·/policy-board·/hotdeal 공통. Notion 커서 기반 쿼리는 임의 페이지로
// 바로 점프하는 게 원래 불가능함(오프셋이 없음) — 대신 이미 방문한 페이지들의
// 진입 커서가 URL의 `prev` 스택에 남아있으므로, **지금까지 방문한 페이지
// 범위 안에서만** 숫자 버튼으로 바로 이동 가능하게 하고, 아직 안 가본
// 다음 페이지는 ">>"로 한 번에 한 페이지씩만 더 열 수 있게 함(그 순간 커서를
// 새로 받아와야 하므로). 방문 범위가 9페이지를 넘으면 최근 9개만 보여줌 —
// 서버 컴포넌트에서 그대로 쓸 수 있게 순수 렌더링 함수(상태 없음, "use
// client" 불필요)로 둠. nextHref는 호출부가 이미 갖고 있는 cursor로 직접
// 계산해서 넘김(이 컴포넌트는 그 계산에 필요한 현재 페이지의 원본 cursor
// 값을 안 받으므로 스스로 다시 계산할 수 없음).
const WINDOW_SIZE = 9;

export default function CursorPageNav({
  pageNumber,
  prevCursors,
  nextHref,
  buildHref,
}: {
  pageNumber: number;
  prevCursors: string[];
  nextHref: string | null;
  buildHref: (cursor: string, prevCursors: string[]) => string;
}) {
  if (pageNumber <= 1 && !nextHref) return null;

  const windowStart = Math.max(1, pageNumber - WINDOW_SIZE + 1);
  const pages = Array.from({ length: pageNumber - windowStart + 1 }, (_, i) => windowStart + i);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {pages.map((n) => {
        const isCurrent = n === pageNumber;
        return isCurrent ? (
          <span
            key={n}
            aria-current="page"
            className="min-w-8 rounded-md border border-primary bg-primary px-2.5 py-1.5 text-center text-sm font-semibold text-white"
          >
            {n}
          </span>
        ) : (
          <Link
            key={n}
            href={buildHref(prevCursors[n - 1] ?? "", prevCursors.slice(0, n - 1))}
            className="min-w-8 rounded-md border border-hairline px-2.5 py-1.5 text-center text-sm font-semibold text-ink transition hover:bg-bg"
          >
            {n}
          </Link>
        );
      })}
      {nextHref && (
        <Link
          href={nextHref}
          className="rounded-md border border-hairline px-2.5 py-1.5 text-sm font-semibold text-ink transition hover:bg-bg"
          aria-label="다음 페이지"
        >
          »
        </Link>
      )}
    </div>
  );
}
