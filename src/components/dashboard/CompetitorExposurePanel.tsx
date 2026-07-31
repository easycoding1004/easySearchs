import type { DashboardExposureResult } from "@/lib/dashboard/dashboardExposure";
import { formatKstDateTime } from "@/lib/utils/formatDate";

export interface ExposureDomainEntry {
  domain: string;
  isMine: boolean;
}

export default function CompetitorExposurePanel({
  results,
  domains,
  fetchedAt,
}: {
  results: DashboardExposureResult[];
  domains: ExposureDomainEntry[];
  fetchedAt: string;
}) {
  if (domains.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-hairline bg-surface p-5 text-sm text-ink-muted">
        내 블로그·비교 블로그가 입력되어 있지 않습니다. 블로그지수에서 다시 조회할 때 입력해
        주세요.
      </section>
    );
  }

  function columnLabel(entry: ExposureDomainEntry) {
    return entry.isMine ? `${entry.domain} (내 블로그)` : entry.domain;
  }

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-ink">블로그 노출 순위</h2>
        <span className="text-xs text-ink-muted">
          {formatKstDateTime(fetchedAt)} 기준
        </span>
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-hairline sm:block">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">키워드</th>
              {domains.map((d) => (
                <th
                  key={d.domain}
                  className={`max-w-[220px] break-words px-3 py-2 font-medium ${d.isMine ? "text-primary" : ""}`}
                >
                  {columnLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {results.map((row) => (
              <tr key={row.keyword}>
                <td className="px-3 py-2 font-medium text-ink">{row.keyword}</td>
                {domains.map((d) => (
                  <td key={d.domain} className="px-3 py-2">
                    {row.ranks[d.domain] != null ? (
                      <span className="font-medium text-ink">{row.ranks[d.domain]}위</span>
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
              {domains.map((d) => (
                <div key={d.domain} className="flex items-center justify-between gap-3 text-sm">
                  <dt className={`break-all ${d.isMine ? "font-medium text-primary" : "text-ink-muted"}`}>
                    {columnLabel(d)}
                  </dt>
                  <dd className="shrink-0">
                    {row.ranks[d.domain] != null ? (
                      <span className="font-medium text-ink">{row.ranks[d.domain]}위</span>
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
