import Link from "next/link";

// 2026-08 유입 전략(활성 신호) — 홈 히어로 아래에 "방금 다른 방문자들이
// 조회한 키워드"를 흐르는 띠로 보여줌. 실제 검색 세션 데이터만 쓰고(가짜
// 활동 금지 원칙 §18.7.1), 키워드 사전 페이지가 존재하는 것만 링크로 걸어
// 404 링크를 만들지 않음(호출부에서 directory set으로 필터해서 넘김).
// 마퀴 애니메이션은 TrendTicker와 같은 트랙 클래스(trend-ticker-track,
// globals.css — prefers-reduced-motion이면 자동으로 정지·스크롤 전환)를 재사용.
export default function RecentKeywordTicker({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) return null;

  const track = (
    <div className="flex shrink-0 items-center gap-3 pr-3">
      {keywords.map((keyword) => (
        <Link
          key={keyword}
          href={`/keyword/${encodeURIComponent(keyword)}`}
          className="shrink-0 whitespace-nowrap rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-medium text-ink transition hover:border-primary hover:text-primary"
        >
          {keyword}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="flex w-full max-w-2xl items-center gap-3">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        방금 조회된 키워드
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="trend-ticker-track flex w-max">
          {track}
          {track}
        </div>
      </div>
    </div>
  );
}
