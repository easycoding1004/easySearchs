"use client";

import Link from "next/link";
import type { SearchSession } from "@/lib/notion/types";
import { formatKstDateTime } from "@/lib/utils/formatDate";
import PaginatedCardGrid from "@/components/admin/PaginatedCardGrid";

// 2026-08 추가(사용자 요청 — "검색 기록정보") — 로그인 상태로 진행한 키워드
// 검색만 여기 걸림(§10.2 원칙상 비로그인 검색은 계정에 안 걸리는 게 정상이라,
// 이 계정으로 로그인하기 전에 한 검색은 안 보임).
export default function MySearchHistoryCards({ sessions }: { sessions: SearchSession[] }) {
  return (
    <PaginatedCardGrid
      items={sessions}
      keyExtractor={(session) => session.id}
      emptyMessage="로그인 상태로 진행한 검색 기록이 없어요."
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
