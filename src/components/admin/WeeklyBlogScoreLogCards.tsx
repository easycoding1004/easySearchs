import Link from "next/link";
import type { BlogScoreSession } from "@/lib/notion/types";
import { formatKstDateTime } from "@/lib/utils/formatDate";

export default function WeeklyBlogScoreLogCards({ sessions }: { sessions: BlogScoreSession[] }) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-hairline p-4 text-sm text-ink-muted">
        최근 7일간 블로그지수 확인 기록이 없어요.
      </p>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((session) => (
        <Link
          key={session.id}
          href={`/dashboard/${session.id}`}
          className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-primary"
        >
          <span className="line-clamp-2 text-sm font-medium text-ink">{session.myBlogDomain}</span>
          <span className="text-xs text-ink-muted">{formatKstDateTime(session.searchedAt)}</span>
          <span className="text-xs text-ink-muted">
            키워드 {session.keywords.length}개 · 비교 블로그 {session.competitorDomains.length}곳
          </span>
        </Link>
      ))}
    </div>
  );
}
