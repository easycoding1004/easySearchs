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

  return (
    <div className="flex flex-col gap-3">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((item) => (
          <Fragment key={keyExtractor(item)}>{renderItem(item)}</Fragment>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="rounded-md border border-hairline px-3 py-1.5 font-semibold text-ink transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← 이전
          </button>
          <span className="text-ink-muted">
            {currentPage + 1} / {totalPages}페이지 · 총 {items.length}건
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="rounded-md border border-hairline px-3 py-1.5 font-semibold text-ink transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}
