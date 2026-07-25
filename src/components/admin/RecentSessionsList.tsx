import Link from "next/link";
import type { SearchSession } from "@/lib/notion/types";
import { formatKstDateTime } from "@/lib/utils/formatDate";

export default function RecentSessionsList({
  sessions,
}: {
  sessions: SearchSession[];
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-ink-muted">아직 검색 기록이 없어요.</p>;
  }

  return (
    <ul className="w-full divide-y divide-hairline rounded-lg border border-hairline bg-surface">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link
            href={`/result/${session.id}`}
            className="flex flex-col gap-1 px-4 py-3 text-sm hover:bg-bg sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <span className="font-medium text-ink">{session.title}</span>
            <span className="shrink-0 text-ink-muted">
              {formatKstDateTime(session.searchedAt)} · {session.resultCount}건
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
