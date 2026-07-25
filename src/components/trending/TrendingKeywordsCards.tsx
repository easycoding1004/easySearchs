import Link from "next/link";
import type { TrendingKeywordWithVolume } from "@/lib/googleTrends/client";

function formatNaverCount(pc: number | null, mobile: number | null): string {
  if (pc == null || mobile == null) return "네이버 데이터 없음";
  return `${(pc + mobile).toLocaleString()}회 검색`;
}

// 홈페이지용 미리보기 카드 — 전체 표는 /trending에서.
export default function TrendingKeywordsCards({
  items,
}: {
  items: TrendingKeywordWithVolume[];
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.title}
          href="/trending"
          className="flex flex-col gap-2 rounded-lg border border-hairline bg-bg p-4 transition ease-spring hover:border-primary motion-safe:active:scale-[0.97]"
        >
          <span className="self-start rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {item.approxTraffic || "-"}
          </span>
          <span className="line-clamp-1 font-semibold text-ink">{item.title}</span>
          <span className="text-xs text-ink-muted">
            {formatNaverCount(item.naverPcCount, item.naverMobileCount)}
          </span>
        </Link>
      ))}
    </div>
  );
}
