import Link from "next/link";
import type { SearchSession } from "@/lib/notion/types";
import { formatKstDateTime } from "@/lib/utils/formatDate";

export default function WeeklySearchLogCards({ sessions }: { sessions: SearchSession[] }) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-hairline p-4 text-sm text-ink-muted">
        최근 7일간 검색 기록이 없어요.
      </p>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((session) => (
        <Link
          key={session.id}
          href={`/result/${session.id}`}
          className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-primary"
        >
          <span className="line-clamp-2 text-sm font-medium text-ink">{session.keyword}</span>
          <span className="text-xs text-ink-muted">{formatKstDateTime(session.searchedAt)}</span>
          <span className="text-xs text-ink-muted">결과 {session.resultCount}건</span>
        </Link>
      ))}
    </div>
  );
}
