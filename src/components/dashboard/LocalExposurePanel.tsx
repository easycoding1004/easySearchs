import type { DashboardLocalExposureResult, LocalExposureEntry } from "@/lib/dashboard/dashboardExposure";
import { formatKstDateTime } from "@/lib/utils/formatDate";

// 지역검색 API는 display 최대 5로 하드캡되어 있어(§CLAUDE.md 10.3.2) 6위
// 밖은 실제 순위와 무관하게 항상 "미노출"로 보임 — 그래서 "노출 중"의 기준을
// 5위 이내로 잡는다.
const VISIBLE_RANK_THRESHOLD = 5;

function summarize(mineBusinessName: string, results: DashboardLocalExposureResult[]): string | null {
  if (results.length === 0) return null;
  const visibleCount = results.filter(
    (r) => (r.ranks[mineBusinessName] ?? Infinity) <= VISIBLE_RANK_THRESHOLD
  ).length;
  if (visibleCount === 0) {
    return `조회한 키워드 ${results.length}개 중 지역·플레이스 상위 5위 안에 노출된 게 없어요. 업체 정보(카테고리·설명)를 점검해보세요.`;
  }
  return `조회한 키워드 ${results.length}개 중 ${visibleCount}개에서 지역·플레이스 상위 5위 안에 노출되고 있어요.`;
}

export default function LocalExposurePanel({
  results,
  entries,
  fetchedAt,
}: {
  results: DashboardLocalExposureResult[];
  entries: LocalExposureEntry[];
  fetchedAt: string;
}) {
  const mine = entries.find((e) => e.isMine);

  if (entries.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-hairline bg-surface p-5 text-sm text-ink-muted">
        업체명이 입력되어 있지 않아 지역·플레이스 진단을 확인할 수 없어요. 블로그지수에서 다시
        조회할 때 업체명을 입력해 주세요.
      </section>
    );
  }

  const summary = mine ? summarize(mine.businessName, results) : null;

  function columnLabel(entry: LocalExposureEntry) {
    return entry.isMine ? `${entry.label} (내 업체)` : entry.label;
  }

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-ink">지역·플레이스 진단</h2>
        <span className="text-xs text-ink-muted">{formatKstDateTime(fetchedAt)} 기준</span>
      </div>
      <p className="mb-4 text-xs text-ink-muted">
        네이버 지역검색 결과는 최대 5위까지만 제공돼요. 6위 밖은 실제 순위와 무관하게 항상
        &quot;미노출&quot;로 표시됩니다.
      </p>

      {summary && (
        <p className="mb-4 rounded-md border border-hairline bg-bg p-3 text-sm text-ink">{summary}</p>
      )}

      <div className="hidden overflow-x-auto rounded-md border border-hairline sm:block">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">키워드</th>
              {entries.map((e) => (
                <th
                  key={e.businessName}
                  className={`max-w-[200px] break-words px-3 py-2 font-medium ${e.isMine ? "text-primary" : ""}`}
                >
                  {columnLabel(e)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {results.map((row) => (
              <tr key={row.keyword}>
                <td className="px-3 py-2 font-medium text-ink">{row.keyword}</td>
                {entries.map((e) => (
                  <td key={e.businessName} className="px-3 py-2">
                    {row.ranks[e.businessName] != null ? (
                      <span className="font-medium text-ink">{row.ranks[e.businessName]}위</span>
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
              {entries.map((e) => (
                <div key={e.businessName} className="flex items-center justify-between gap-3 text-sm">
                  <dt className={`break-all ${e.isMine ? "font-medium text-primary" : "text-ink-muted"}`}>
                    {columnLabel(e)}
                  </dt>
                  <dd className="shrink-0">
                    {row.ranks[e.businessName] != null ? (
                      <span className="font-medium text-ink">{row.ranks[e.businessName]}위</span>
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
