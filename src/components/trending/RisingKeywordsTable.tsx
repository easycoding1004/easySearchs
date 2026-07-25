import type { RisingKeyword } from "@/lib/notion/keywordSnapshots";

function formatChange(ratio: number): string {
  return `+${Math.round(ratio * 100)}%`;
}

export default function RisingKeywordsTable({ items }: { items: RisingKeyword[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-hairline p-6 text-center text-sm text-ink-muted">
        아직 데이터가 부족해요 — 이 사이트에서 반복 조회된 키워드가 쌓이면 여기 표시됩니다.
      </div>
    );
  }

  return (
    <>
      {/* PC / tablet */}
      <div className="hidden w-full overflow-x-auto rounded-md border border-hairline md:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-bg text-left text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">키워드</th>
              <th className="px-3 py-2 font-medium text-right">증가율</th>
              <th className="px-3 py-2 font-medium text-right">이전 검색량</th>
              <th className="px-3 py-2 font-medium text-right">최근 검색량</th>
              <th className="px-3 py-2 font-medium">비교 기간</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {items.map((item) => (
              <tr key={item.keyword}>
                <td className="px-3 py-2 font-medium text-ink">{item.keyword}</td>
                <td className="px-3 py-2 text-right font-semibold text-primary">
                  {formatChange(item.changeRatio)}
                </td>
                <td className="px-3 py-2 text-right text-ink-muted">
                  {item.earliestCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {item.latestCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {item.earliestDate} ~ {item.latestDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {items.map((item) => (
          <div key={item.keyword} className="rounded-md border border-hairline p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium text-ink">{item.keyword}</span>
              <span className="shrink-0 font-semibold text-primary">
                {formatChange(item.changeRatio)}
              </span>
            </div>
            <div className="text-sm text-ink-muted">
              {item.earliestCount.toLocaleString()} → {item.latestCount.toLocaleString()}
            </div>
            <div className="text-xs text-ink-muted">
              {item.earliestDate} ~ {item.latestDate}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
