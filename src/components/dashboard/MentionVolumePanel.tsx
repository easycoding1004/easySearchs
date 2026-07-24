import type { MentionVolume } from "@/lib/mentions";

export default function MentionVolumePanel({
  rows,
  fetchedAt,
}: {
  rows: MentionVolume[];
  fetchedAt: string;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">블로그·카페 언급량</h2>
          <p className="text-sm text-ink-muted">
            키워드가 포함된 전체 게시물 수 (검색량과는 다른 지표입니다)
          </p>
        </div>
        <span className="text-xs text-ink-muted">
          {new Date(fetchedAt).toLocaleString("ko-KR")} 기준
        </span>
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-hairline sm:block">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">키워드</th>
              <th className="px-3 py-2 font-medium text-right">블로그 언급량</th>
              <th className="px-3 py-2 font-medium text-right">카페 언급량</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <tr key={row.keyword}>
                <td className="px-3 py-2 font-medium text-ink">{row.keyword}</td>
                <td className="px-3 py-2 text-right text-ink">
                  {row.blogTotal.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {row.cafeTotal.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((row) => (
          <div key={row.keyword} className="rounded-md border border-hairline p-3">
            <div className="mb-1 font-medium text-ink">{row.keyword}</div>
            <div className="text-sm text-ink-muted">
              블로그 {row.blogTotal.toLocaleString()} · 카페{" "}
              {row.cafeTotal.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
