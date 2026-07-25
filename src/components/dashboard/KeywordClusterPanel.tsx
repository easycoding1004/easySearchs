import type { NormalizedKeywordRow } from "@/lib/naver/types";
import type { TitleTagRecommendation } from "@/lib/dashboard/keywordCluster";
import type { CompetitorKeywordProfile } from "@/lib/dashboard/competitorKeywords";
import { formatKstDateTime } from "@/lib/utils/formatDate";

const COMP_COLOR: Record<string, string> = {
  낮음: "var(--chart-series-pc)", // slot 1 blue
  중간: "var(--chart-series-mobile)", // slot 2 orange
  높음: "var(--chart-series-tertiary)", // slot 3 aqua
};

function nodeRadius(volume: number, maxVolume: number): number {
  if (maxVolume <= 0) return 6;
  const ratio = Math.sqrt(volume / maxVolume);
  return 6 + ratio * 22;
}

function MindMap({
  seed,
  nodes,
  inferredSet,
}: {
  seed: string;
  nodes: NormalizedKeywordRow[];
  inferredSet: Set<string>;
}) {
  const size = 520;
  const center = size / 2;
  const orbitRadius = size / 2 - 60;
  const maxVolume = Math.max(
    1,
    ...nodes.map((n) => n.monthlyPcQcCnt + n.monthlyMobileQcCnt)
  );

  return (
    <div className="panel-transition w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height={size}
        role="img"
        aria-label={`${seed} 연관 키워드 클러스터`}
        style={{ minWidth: 360, maxWidth: 560 }}
      >
        {nodes.map((node, i) => {
          const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
          const x = center + orbitRadius * Math.cos(angle);
          const y = center + orbitRadius * Math.sin(angle);
          const volume = node.monthlyPcQcCnt + node.monthlyMobileQcCnt;
          const r = nodeRadius(volume, maxVolume);
          const color = COMP_COLOR[node.compIdx ?? ""] ?? "var(--chart-text-muted)";
          const labelAnchor = x > center + 4 ? "start" : x < center - 4 ? "end" : "middle";
          const labelDx = x > center + 4 ? 8 : x < center - 4 ? -8 : 0;
          const isInferred = inferredSet.has(node.relKeyword);

          return (
            <g key={node.relKeyword}>
              <line
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="var(--chart-gridline)"
                strokeWidth={1}
              />
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={color}
                stroke="var(--chart-surface)"
                strokeWidth={2}
                strokeDasharray={isInferred ? "3 2" : undefined}
                className="transition-transform ease-spring hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                <title>
                  {node.relKeyword} · 합계 {volume.toLocaleString()} · 경쟁 {node.compIdx ?? "-"}
                  {isInferred ? " · 추론 키워드" : ""}
                </title>
              </circle>
              <text
                x={x + labelDx}
                y={y + r + 12}
                textAnchor={labelAnchor}
                fontSize={11}
                fill="var(--chart-text-secondary)"
              >
                {node.relKeyword}
              </text>
            </g>
          );
        })}

        <circle
          cx={center}
          cy={center}
          r={30}
          fill="var(--chart-text-primary)"
          stroke="var(--chart-surface)"
          strokeWidth={3}
        />
        <text
          x={center}
          y={center + 4}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill="var(--chart-surface)"
        >
          {seed.length > 6 ? `${seed.slice(0, 6)}…` : seed}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--chart-series-pc)" }}
          />
          경쟁 낮음
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--chart-series-mobile)" }}
          />
          경쟁 중간
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--chart-series-tertiary)" }}
          />
          경쟁 높음
        </span>
        <span className="text-ink-muted">원 크기 = 검색량</span>
        {inferredSet.size > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-ink-muted" />
            추론 키워드
          </span>
        )}
      </div>
    </div>
  );
}

function KeywordChips({
  rows,
  inferredSet,
}: {
  rows: NormalizedKeywordRow[];
  inferredSet: Set<string>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">추천할 키워드가 없습니다.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {rows.map((row) => (
        <li
          key={row.relKeyword}
          className="rounded-full border border-hairline px-3 py-1 text-sm text-ink"
        >
          {row.relKeyword}
          <span className="ml-1.5 text-xs text-ink-muted">
            {(row.monthlyPcQcCnt + row.monthlyMobileQcCnt).toLocaleString()}
          </span>
          {inferredSet.has(row.relKeyword) && (
            <span className="ml-1.5 text-xs text-ink-muted">· 추론</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function KeywordClusterPanel({
  seed,
  nodes,
  inferredKeywords,
  recommendation,
  competitorProfiles,
  fetchedAt,
}: {
  seed: string;
  nodes: NormalizedKeywordRow[];
  inferredKeywords: string[];
  recommendation: TitleTagRecommendation;
  competitorProfiles: CompetitorKeywordProfile[];
  fetchedAt: string;
}) {
  const inferredSet = new Set(inferredKeywords);
  return (
    <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">
            키워드 클러스터 &amp; 콘텐츠 전략 ({seed})
          </h2>
          <p className="text-sm text-ink-muted">
            검색량·경쟁정도 데이터 기반 규칙 추천입니다 (AI 생성 아님).
            {inferredSet.size > 0 &&
              " 네이버 연관 키워드가 적어 '추론' 표시된 키워드는 이 키워드로 검색되는 블로그 글 제목에서 자주 나오는 단어로 실제 검색량을 조회한 결과입니다."}
          </p>
        </div>
        <span className="text-xs text-ink-muted">
          {formatKstDateTime(fetchedAt)} 기준
        </span>
      </div>

      <MindMap seed={seed} nodes={nodes} inferredSet={inferredSet} />

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">
            제목 추천 키워드 (검색량 높음 · 경쟁 낮음 우선)
          </h3>
          <KeywordChips rows={recommendation.titleKeywords} inferredSet={inferredSet} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">태그 추천 키워드</h3>
          <KeywordChips rows={recommendation.tagKeywords} inferredSet={inferredSet} />
        </div>
      </div>

      {competitorProfiles.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-ink">
            경쟁사가 자주 쓰는 단어 (게시물 제목 형태소 분석 + 태그)
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {competitorProfiles.map((profile) => (
              <div key={profile.domain} className="rounded-md border border-hairline p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="break-all text-sm font-medium text-ink">
                    {profile.domain}
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    글 {profile.postsSeen}건
                  </span>
                </div>
                {profile.terms.length === 0 ? (
                  <p className="text-sm text-ink-muted">수집된 게시물이 없습니다.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {profile.terms.map((t) => (
                      <li
                        key={t.term}
                        className="rounded-full bg-bg px-2 py-0.5 text-xs text-ink-muted"
                      >
                        {t.term} ({t.count})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
