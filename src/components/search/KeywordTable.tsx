import type { KeywordRecord } from "@/lib/notion/types";

function formatBlogStat(value: number | null): string {
  return value == null ? "-" : value.toLocaleString();
}

function formatSaturation(value: number | null): string {
  return value == null ? "-" : `${value.toFixed(1)}%`;
}

export default function KeywordTable({ records }: { records: KeywordRecord[] }) {
  return (
    <>
      {/* PC / tablet: full table, horizontal scroll only as a last resort */}
      <div className="hidden w-full overflow-x-auto rounded-md border border-hairline md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-bg text-left text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">키워드</th>
              <th className="px-3 py-2 font-medium">구분</th>
              <th className="px-3 py-2 font-medium text-right">PC 검색수</th>
              <th className="px-3 py-2 font-medium text-right">모바일 검색수</th>
              <th className="px-3 py-2 font-medium text-right">합계</th>
              <th className="px-3 py-2 font-medium">경쟁정도</th>
              <th className="px-3 py-2 font-medium text-right">월평균노출광고수</th>
              <th className="px-3 py-2 font-medium text-right">총 블로그 발행량</th>
              <th className="px-3 py-2 font-medium text-right">월간 블로그 발행량</th>
              <th className="px-3 py-2 font-medium text-right">블로그 포화도</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {records.map((record) => (
              <tr key={record.id}>
                <td className="px-3 py-2 font-medium text-ink">{record.keyword}</td>
                <td className="px-3 py-2 text-ink-muted">{record.kind}</td>
                <td className="px-3 py-2 text-right text-ink">
                  {record.pcCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {record.mobileCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-medium text-ink">
                  {record.totalCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-ink-muted">{record.compIdx ?? "-"}</td>
                <td className="px-3 py-2 text-right text-ink">
                  {record.avgAdDepth.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {formatBlogStat(record.totalBlogPosts)}
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {formatBlogStat(record.monthlyBlogPosts)}
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {formatSaturation(record.blogSaturation)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per keyword — 10 columns never fit a phone screen */}
      <div className="flex flex-col gap-2 md:hidden">
        {records.map((record) => (
          <div key={record.id} className="rounded-md border border-hairline p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium text-ink">{record.keyword}</span>
              <span className="shrink-0 text-xs text-ink-muted">{record.kind}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-muted">PC 검색수</dt>
              <dd className="text-right text-ink">{record.pcCount.toLocaleString()}</dd>
              <dt className="text-ink-muted">모바일 검색수</dt>
              <dd className="text-right text-ink">
                {record.mobileCount.toLocaleString()}
              </dd>
              <dt className="text-ink-muted">합계</dt>
              <dd className="text-right font-medium text-ink">
                {record.totalCount.toLocaleString()}
              </dd>
              <dt className="text-ink-muted">경쟁정도</dt>
              <dd className="text-right text-ink">{record.compIdx ?? "-"}</dd>
              <dt className="text-ink-muted">월평균노출광고수</dt>
              <dd className="text-right text-ink">
                {record.avgAdDepth.toLocaleString()}
              </dd>
              <dt className="text-ink-muted">총 블로그 발행량</dt>
              <dd className="text-right text-ink">{formatBlogStat(record.totalBlogPosts)}</dd>
              <dt className="text-ink-muted">월간 블로그 발행량</dt>
              <dd className="text-right text-ink">{formatBlogStat(record.monthlyBlogPosts)}</dd>
              <dt className="text-ink-muted">블로그 포화도</dt>
              <dd className="text-right text-ink">{formatSaturation(record.blogSaturation)}</dd>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
