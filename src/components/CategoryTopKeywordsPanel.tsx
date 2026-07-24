import type { CategoryDef } from "@/lib/naver/categoryTrends";
import type { NormalizedKeywordRow } from "@/lib/naver/types";

export default function CategoryTopKeywordsPanel({
  category,
  rows,
  fetchedAt,
  error,
}: {
  category: CategoryDef;
  rows: NormalizedKeywordRow[];
  fetchedAt: number | null;
  error?: boolean;
}) {
  return (
    <div
      id="category-trends"
      className="flex w-full flex-col gap-2 rounded-lg border border-hairline bg-surface p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-ink">
          {category.label} 관련 검색어 BEST 10
        </h3>
        <p className="text-xs text-ink-muted">
          네이버 공식 인기 검색어 순위가 아니라, &quot;{category.seedKeyword}&quot;
          연관검색어 중 검색량이 높은 순이에요.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-error">불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-muted">데이터가 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <li key={row.relKeyword} className="flex items-center gap-2 text-sm">
              <span className="w-5 shrink-0 text-right font-semibold text-primary">
                {i + 1}
              </span>
              <span className="flex-1 truncate text-ink">{row.relKeyword}</span>
              <span className="shrink-0 text-xs text-ink-muted">
                {(row.monthlyPcQcCnt + row.monthlyMobileQcCnt).toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}

      {fetchedAt && (
        <p className="text-xs text-ink-muted">
          {new Date(fetchedAt).toLocaleString("ko-KR")} 기준
        </p>
      )}
    </div>
  );
}
