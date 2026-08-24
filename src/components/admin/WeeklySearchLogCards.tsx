"use client";

import Link from "next/link";
import type { SearchSession } from "@/lib/notion/types";
import { formatKstDateTime } from "@/lib/utils/formatDate";
import PaginatedCardGrid from "./PaginatedCardGrid";

export default function WeeklySearchLogCards({ sessions }: { sessions: SearchSession[] }) {
  return (
    <PaginatedCardGrid
      items={sessions}
      keyExtractor={(session) => session.id}
      emptyMessage="최근 7일간 검색 기록이 없어요."
      renderItem={(session) => (
        <Link
          href={`/result/${session.id}`}
          className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-primary"
        >
          <span className="line-clamp-2 text-sm font-medium text-ink">{session.keyword}</span>
          <span className="text-xs text-ink-muted">{formatKstDateTime(session.searchedAt)}</span>
          <span className="text-xs text-ink-muted">결과 {session.resultCount}건</span>
        </Link>
      )}
    />
  );
}
