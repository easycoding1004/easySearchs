import type { DashboardExposureResult } from "@/lib/dashboard/dashboardExposure";

export default function CompetitorExposurePanel({
  results,
  competitors,
  fetchedAt,
}: {
  results: DashboardExposureResult[];
  competitors: string[];
  fetchedAt: string;
}) {
  if (competitors.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-hairline bg-surface p-5 text-sm text-ink-muted">
        경쟁업체가 등록되어 있지 않습니다. 설정에서 추가해 주세요.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-ink">경쟁업체 블로그 노출 순위</h2>
        <span className="text-xs text-ink-muted">
          {new Date(fetchedAt).toLocaleString("ko-KR")} 기준
        </span>
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-hairline sm:block">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">키워드</th>
              {competitors.map((c) => (
                <th key={c} className="max-w-[220px] break-words px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {results.map((row) => (
              <tr key={row.keyword}>
                <td className="px-3 py-2 font-medium text-ink">{row.keyword}</td>
                {competitors.map((c) => (
                  <td key={c} className="px-3 py-2">
                    {row.ranks[c] != null ? (
                      <span className="font-medium text-ink">{row.ranks[c]}위</span>
                    ) : (
                      <span className="text-ink-muted">미노출</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:hidden">
        {results.map((row) => (
          <div key={row.keyword} className="rounded-md border border-hairline p-3">
            <div className="mb-2 font-medium text-ink">{row.keyword}</div>
            <dl className="flex flex-col gap-1">
              {competitors.map((c) => (
                <div key={c} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="break-all text-ink-muted">{c}</dt>
                  <dd className="shrink-0">
                    {row.ranks[c] != null ? (
                      <span className="font-medium text-ink">{row.ranks[c]}위</span>
                    ) : (
                      <span className="text-ink-muted">미노출</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
