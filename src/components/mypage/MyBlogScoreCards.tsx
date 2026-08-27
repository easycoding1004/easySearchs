"use client";

import Link from "next/link";
import type { BlogScoreSession } from "@/lib/notion/types";
import { formatKstDateTime } from "@/lib/utils/formatDate";
import PaginatedCardGrid from "@/components/admin/PaginatedCardGrid";

// 2026-08 추가(제품 감사 — "장기 제안: 블로그지수 변화 추이 기록") — 조회
// 기록 목록만 우선 제공(v1). 세션마다 컴포짓 점수를 다시 계산해 보여주려면
// 세션 수만큼 "블로그지수 결과" DB를 추가 조회해야 해서(N+1), 방문 기록이
// 쌓일수록 이 페이지 하나가 느려지는 비용이 생김 — 그래서 이번엔 목록 +
// 결과 링크까지만 제공하고, 실제 점수 비교는 각 결과 페이지에서 확인하도록
// 함. 점수 자체를 목록에 얹는 건 실사용을 보고 필요성이 확인되면 캐싱과
// 함께 재검토할 것.
export default function MyBlogScoreCards({ sessions }: { sessions: BlogScoreSession[] }) {
  return (
    <PaginatedCardGrid
      items={sessions}
      keyExtractor={(session) => session.id}
      emptyMessage="블로그지수를 조회한 기록이 없어요."
      renderItem={(session) => (
        <Link
          href={`/dashboard/${session.id}`}
          className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-primary"
        >
          <span className="line-clamp-1 text-sm font-medium text-ink">{session.myBlogDomain}</span>
          <span className="text-xs text-ink-muted">{formatKstDateTime(session.searchedAt)}</span>
          {session.competitorDomains.length > 0 && (
            <span className="text-xs text-ink-muted">비교 블로그 {session.competitorDomains.length}곳</span>
          )}
        </Link>
      )}
    />
  );
}
