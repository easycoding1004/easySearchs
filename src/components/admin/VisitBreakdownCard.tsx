import type { VisitBreakdownEntry } from "@/lib/notion/visits";

function BreakdownList({ entries }: { entries: VisitBreakdownEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">오늘 방문 기록이 없어요.</p>;
  }

  const total = entries.reduce((sum, e) => sum + e.count, 0);

  return (
    <ul className="flex flex-col gap-1.5">
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-ink">{entry.label}</span>
          <span className="shrink-0 text-ink-muted">
            {entry.count.toLocaleString()}회 · {Math.round((entry.count / total) * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function VisitBreakdownCard({
  byReferrer,
  byLandingPage,
}: {
  byReferrer: VisitBreakdownEntry[];
  byLandingPage: VisitBreakdownEntry[];
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink">오늘 유입 경로</h3>
        <BreakdownList entries={byReferrer} />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink">오늘 진입 페이지</h3>
        <BreakdownList entries={byLandingPage} />
      </div>
    </div>
  );
}
