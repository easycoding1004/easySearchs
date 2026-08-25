"use client";

import { Fragment, useState } from "react";

// 2026-08 추가(사용자 요청 — "admin페이지도 리스트뷰로 나열된 부분을 10개씩
// 끊어서 카드형으로 각 분류별 보여줘") — WeeklySearchLogCards 등 3개 "최근
// 7일" 섹션이 그 기간 전체 레코드를 페이지네이션 없이 한 그리드에 다 쏟아내고
// 있었음(활동이 많은 날엔 카드가 끝없이 이어짐). 서버에서 이미 7일치를 통째로
// 내려주므로 추가 Notion 조회 없이 클라이언트에서 10개 단위로 잘라 보여주는
// 로컬 페이지네이션 — /board·/hotdeal의 커서 기반 서버 페이지네이션과 달리
// 여기는 데이터가 이미 다 있어서 훨씬 단순한 방식으로 충분함. 3개 섹션이
// 각자 독립적인 페이지 상태를 가짐(분류별로 따로 넘길 수 있어야 하므로).
export default function PaginatedCardGrid<T>({
  items,
  keyExtractor,
  renderItem,
  emptyMessage,
  pageSize = 10,
}: {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  emptyMessage: string;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-hairline p-4 text-sm text-ink-muted">{emptyMessage}</p>
    );
  }

  const totalPages = Math.ceil(items.length / pageSize);
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  // 2026-08 추가(사용자 요청 — "페이징을 1,2,3,4,5,6,7,8,9,>> 형태로") — 데이터가
  // 이미 다 로드돼 있어서(서버가 전체 기간을 통째로 내려줌) 임의 페이지로
  // 바로 점프하는 게 아무 추가 비용 없이 가능함. 9개씩 창을 옮겨가며
  // 보여주고 «/»로 창 자체를 넘김 — 창 안의 숫자는 클릭 한 번에 바로 이동.
  const WINDOW_SIZE = 9;
  const windowStart = Math.floor(currentPage / WINDOW_SIZE) * WINDOW_SIZE;
  const windowEnd = Math.min(windowStart + WINDOW_SIZE, totalPages);
  const windowPages = Array.from({ length: windowEnd - windowStart }, (_, i) => windowStart + i);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((item) => (
          <Fragment key={keyExtractor(item)}>{renderItem(item)}</Fragment>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm">
          {windowStart > 0 && (
            <button
              type="button"
              onClick={() => setPage(windowStart - WINDOW_SIZE)}
              className="rounded-md border border-hairline px-2.5 py-1.5 font-semibold text-ink transition hover:bg-bg"
              aria-label="이전 페이지 묶음"
            >
              «
            </button>
          )}
          {windowPages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              aria-current={p === currentPage ? "page" : undefined}
              className={`min-w-8 rounded-md border px-2.5 py-1.5 font-semibold transition ${
                p === currentPage
                  ? "border-primary bg-primary text-white"
                  : "border-hairline text-ink hover:bg-bg"
              }`}
            >
              {p + 1}
            </button>
          ))}
          {windowEnd < totalPages && (
            <button
              type="button"
              onClick={() => setPage(windowEnd)}
              className="rounded-md border border-hairline px-2.5 py-1.5 font-semibold text-ink transition hover:bg-bg"
              aria-label="다음 페이지 묶음"
            >
              »
            </button>
          )}
        </div>
      )}
    </div>
  );
}
