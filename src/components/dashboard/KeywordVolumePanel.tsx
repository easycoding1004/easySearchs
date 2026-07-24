import type { NormalizedKeywordRow } from "@/lib/naver/types";
import type { BlogPublishStats } from "@/lib/naver/blogPublishStats";

function formatBlogStat(value: number | undefined): string {
  return value == null ? "-" : value.toLocaleString();
}

function formatSaturation(value: number | undefined): string {
  return value == null ? "-" : `${value.toFixed(1)}%`;
}

export default function KeywordVolumePanel({
  rows,
  publishStats,
  fetchedAt,
}: {
  rows: NormalizedKeywordRow[];
  publishStats: Record<string, BlogPublishStats>;
  fetchedAt: string;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-ink">키워드 검색량</h2>
        <span className="text-xs text-ink-muted">
          {new Date(fetchedAt).toLocaleString("ko-KR")} 기준
        </span>
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-hairline sm:block">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">키워드</th>
              <th className="px-3 py-2 font-medium text-right">PC 검색수</th>
              <th className="px-3 py-2 font-medium text-right">모바일 검색수</th>
              <th className="px-3 py-2 font-medium text-right">합계</th>
              <th className="px-3 py-2 font-medium">경쟁정도</th>
              <th className="px-3 py-2 font-medium text-right">총 블로그 발행량</th>
              <th className="px-3 py-2 font-medium text-right">월간 블로그 발행량</th>
              <th className="px-3 py-2 font-medium text-right">블로그 포화도</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => {
              const stats = publishStats[row.relKeyword];
              return (
                <tr key={row.relKeyword}>
                  <td className="px-3 py-2 font-medium text-ink">
                    {row.relKeyword}
                  </td>
                  <td className="px-3 py-2 text-right text-ink">
                    {row.monthlyPcQcCnt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-ink">
                    {row.monthlyMobileQcCnt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-ink">
                    {(row.monthlyPcQcCnt + row.monthlyMobileQcCnt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{row.compIdx ?? "-"}</td>
                  <td className="px-3 py-2 text-right text-ink">{formatBlogStat(stats?.totalPosts)}</td>
                  <td className="px-3 py-2 text-right text-ink">{formatBlogStat(stats?.monthlyPosts)}</td>
                  <td className="px-3 py-2 text-right text-ink">{formatSaturation(stats?.saturation)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((row) => {
          const stats = publishStats[row.relKeyword];
          return (
            <div key={row.relKeyword} className="rounded-md border border-hairline p-3">
              <div className="mb-1 font-medium text-ink">{row.relKeyword}</div>
              <div className="text-sm text-ink-muted">
                PC {row.monthlyPcQcCnt.toLocaleString()} · 모바일{" "}
                {row.monthlyMobileQcCnt.toLocaleString()} · 합계{" "}
                {(row.monthlyPcQcCnt + row.monthlyMobileQcCnt).toLocaleString()} ·
                경쟁정도 {row.compIdx ?? "-"}
              </div>
              <div className="mt-1 text-sm text-ink-muted">
                총 발행량 {formatBlogStat(stats?.totalPosts)} · 월간 발행량{" "}
                {formatBlogStat(stats?.monthlyPosts)} · 포화도{" "}
                {formatSaturation(stats?.saturation)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
