import type { TrendingKeywordWithVolume } from "@/lib/googleTrends/client";

function formatNaverCount(pc: number | null, mobile: number | null): string {
  if (pc == null || mobile == null) return "네이버 데이터 없음";
  return `${(pc + mobile).toLocaleString()}`;
}

function formatDetail(pc: number | null, mobile: number | null): string {
  if (pc == null || mobile == null) return "-";
  return `PC ${pc.toLocaleString()} · 모바일 ${mobile.toLocaleString()}`;
}

export default function TrendingKeywordsTable({
  items,
}: {
  items: TrendingKeywordWithVolume[];
}) {
  return (
    <>
      {/* PC / tablet */}
      <div className="hidden w-full overflow-x-auto rounded-md border border-hairline md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-bg text-left text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">키워드</th>
              <th className="px-3 py-2 font-medium">구글 트렌드 관심도</th>
              <th className="px-3 py-2 font-medium text-right">네이버 월간검색수</th>
              <th className="px-3 py-2 font-medium">관련 뉴스</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {items.map((item) => (
              <tr key={item.title}>
                <td className="px-3 py-2 font-medium text-ink">{item.title}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {item.approxTraffic || "-"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  <div>{formatNaverCount(item.naverPcCount, item.naverMobileCount)}</div>
                  <div className="text-xs text-ink-muted">
                    {formatDetail(item.naverPcCount, item.naverMobileCount)}
                  </div>
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {item.newsItems[0] ? (
                    <a
                      href={item.newsItems[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-1 hover:text-primary hover:underline"
                    >
                      {item.newsItems[0].title}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {items.map((item) => (
          <div key={item.title} className="rounded-md border border-hairline p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium text-ink">{item.title}</span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {item.approxTraffic || "-"}
              </span>
            </div>
            <div className="text-sm text-ink">
              {formatNaverCount(item.naverPcCount, item.naverMobileCount)}
            </div>
            <div className="text-xs text-ink-muted">
              {formatDetail(item.naverPcCount, item.naverMobileCount)}
            </div>
            {item.newsItems[0] && (
              <a
                href={item.newsItems[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-xs text-ink-muted hover:text-primary hover:underline"
              >
                {item.newsItems[0].title}
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
