import type { DashboardLocalExposureResult } from "@/lib/dashboard/dashboardExposure";
import { formatKstDateTime } from "@/lib/utils/formatDate";

export default function LocalExposurePanel({
  results,
  businessName,
  fetchedAt,
}: {
  results: DashboardLocalExposureResult[];
  businessName: string | null;
  fetchedAt: string;
}) {
  if (!businessName) {
    return (
      <section className="rounded-lg border border-dashed border-hairline bg-surface p-5 text-sm text-ink-muted">
        업체명이 입력되어 있지 않아 지역·플레이스 노출 순위를 확인할 수 없어요. 블로그지수에서
        다시 조회할 때 업체명을 입력해 주세요.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-ink">지역·플레이스 노출 순위</h2>
        <span className="text-xs text-ink-muted">{formatKstDateTime(fetchedAt)} 기준</span>
      </div>
      <p className="mb-4 text-xs text-ink-muted">
        &quot;{businessName}&quot; 기준 · 네이버 지역검색 결과는 최대 5위까지만 제공돼요. 6위
        밖은 실제 순위와 무관하게 항상 &quot;미노출&quot;로 표시됩니다.
      </p>

      <div className="overflow-x-auto rounded-md border border-hairline">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">키워드</th>
              <th className="px-3 py-2 font-medium">지역·플레이스 순위</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {results.map((row) => (
              <tr key={row.keyword}>
                <td className="px-3 py-2 font-medium text-ink">{row.keyword}</td>
                <td className="px-3 py-2">
                  {row.rank != null ? (
                    <span className="font-medium text-ink">{row.rank}위</span>
                  ) : (
                    <span className="text-ink-muted">미노출</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
