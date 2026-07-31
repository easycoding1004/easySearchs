"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendDirection } from "@/lib/naver/trendDirection";
import type { AudienceDimension } from "@/lib/naver/audienceGroups";
import type { TrendDataPoint } from "@/lib/naver/datalabSearchClient";

interface GroupResult {
  label: string;
  direction: TrendDirection | null;
  data: TrendDataPoint[];
}

// 프로젝트에 정의된 시리즈 색상은 5개뿐(globals.css) — 연령대(6그룹)는 마지막
// 하나가 색을 재사용하지만, 범례가 있어 식별에는 문제없음.
const SERIES_COLORS = [
  "var(--chart-series-pc)",
  "var(--chart-series-mobile)",
  "var(--chart-series-tertiary)",
  "var(--chart-series-quaternary)",
  "var(--chart-series-quinary)",
];

interface ChartDatum {
  period: string;
  [group: string]: string | number;
}

// SearchTrendPanel.tsx의 mergeResults와 같은 방식 — 그룹별 기간 데이터를
// 하나의 recharts용 배열로 합침(period 기준으로 정렬·병합).
function mergeGroupData(groups: GroupResult[]): ChartDatum[] {
  const periods = [...new Set(groups.flatMap((g) => g.data.map((d) => d.period)))].sort();
  return periods.map((period) => {
    const datum: ChartDatum = { period };
    for (const group of groups) {
      const point = group.data.find((d) => d.period === period);
      if (point) datum[group.label] = point.ratio;
    }
    return datum;
  });
}

function AudienceLineChart({ groups }: { groups: GroupResult[] }) {
  const data = mergeGroupData(groups);
  if (data.length === 0) return null;

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-gridline)" />
          <XAxis
            dataKey="period"
            axisLine={{ stroke: "var(--chart-baseline)" }}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--chart-text-muted)" }}
            minTickGap={16}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--chart-text-muted)" }}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--chart-surface)",
              border: "1px solid var(--chart-gridline)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--chart-text-secondary)" }} />
          {groups.map((group, i) => (
            <Line
              key={group.label}
              type="monotone"
              dataKey={group.label}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type DimensionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; groups: GroupResult[] };

const DIRECTION_STYLE: Record<TrendDirection, { arrow: string; color: string }> = {
  상승: { arrow: "▲", color: "text-success" },
  보합: { arrow: "－", color: "text-ink-muted" },
  하락: { arrow: "▼", color: "text-error" },
};

function GroupRow({ group }: { group: GroupResult }) {
  const style = group.direction ? DIRECTION_STYLE[group.direction] : null;
  return (
    <div className="flex items-center justify-between rounded-md border border-hairline bg-bg px-3 py-2 text-sm">
      <span className="text-ink">{group.label}</span>
      {style ? (
        <span className={`font-semibold ${style.color}`}>
          {style.arrow} {group.direction}
        </span>
      ) : (
        <span className="text-ink-muted">데이터 없음</span>
      )}
    </div>
  );
}

async function fetchDimension(keyword: string, dimension: AudienceDimension): Promise<GroupResult[]> {
  const res = await fetch("/api/keyword-audience", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, dimension }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { groups?: GroupResult[] };
  return data.groups ?? [];
}

export default function KeywordAudiencePanel({ keyword }: { keyword: string }) {
  // /result 페이지에 도착하자마자 자동으로 안 부름 — 여기가 데이터랩 호출
  // 여러 개(성별 2회+기기 2회, 스로틀 때문에 초당 1개씩)를 새로 추가한
  // 자리라 자동 호출하면 "진행바는 100%인데 페이지가 계속 로딩되는 것처럼
  // 보인다"는 문제가 생김 — 그래서 명시적으로 펼치기 전까지는 요청 자체가
  // 안 나감.
  const [revealed, setRevealed] = useState(false);
  const [gender, setGender] = useState<DimensionState>({ status: "idle" });
  const [device, setDevice] = useState<DimensionState>({ status: "idle" });
  const [age, setAge] = useState<DimensionState>({ status: "idle" });

  function reveal() {
    setRevealed(true);
    setGender({ status: "loading" });
    setDevice({ status: "loading" });
    fetchDimension(keyword, "gender")
      .then((groups) => setGender({ status: "ok", groups }))
      .catch(() => setGender({ status: "error" }));
    fetchDimension(keyword, "device")
      .then((groups) => setDevice({ status: "ok", groups }))
      .catch(() => setDevice({ status: "error" }));
  }

  function loadAge() {
    setAge({ status: "loading" });
    fetchDimension(keyword, "age")
      .then((groups) => setAge({ status: "ok", groups }))
      .catch(() => setAge({ status: "error" }));
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">&quot;{keyword}&quot;는 누가 찾을까?</h2>
          <p className="text-sm text-ink-muted">
            그룹별로 각자 안에서 다시 정규화된 지수라 그룹 간 크기 비교는 어려워요. 대신 최근
            3개월간 각 그룹에서 이 키워드 관심이 오르는지 내리는지만 보여드려요.
          </p>
        </div>
        {!revealed && (
          <button
            type="button"
            onClick={reveal}
            className="shrink-0 self-start rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-bg"
          >
            성별·기기 보기
          </button>
        )}
      </div>

      {revealed && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">성별</h3>
              {gender.status === "loading" && (
                <p className="text-sm text-ink-muted">불러오는 중...</p>
              )}
              {gender.status === "error" && (
                <p className="text-sm text-error">불러오지 못했어요.</p>
              )}
              {gender.status === "ok" && (
                <>
                  {gender.groups.map((g) => (
                    <GroupRow key={g.label} group={g} />
                  ))}
                  <AudienceLineChart groups={gender.groups} />
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">기기</h3>
              {device.status === "loading" && (
                <p className="text-sm text-ink-muted">불러오는 중...</p>
              )}
              {device.status === "error" && (
                <p className="text-sm text-error">불러오지 못했어요.</p>
              )}
              {device.status === "ok" && (
                <>
                  {device.groups.map((g) => (
                    <GroupRow key={g.label} group={g} />
                  ))}
                  <AudienceLineChart groups={device.groups} />
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">연령대</h3>
              {age.status === "idle" && (
                <button
                  type="button"
                  onClick={loadAge}
                  className="rounded-md border border-hairline px-3 py-1 text-xs font-semibold text-ink transition hover:bg-bg"
                >
                  연령대 더보기
                </button>
              )}
            </div>
            {age.status === "loading" && <p className="text-sm text-ink-muted">불러오는 중...</p>}
            {age.status === "error" && <p className="text-sm text-error">불러오지 못했어요.</p>}
            {age.status === "ok" && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {age.groups.map((g) => (
                    <GroupRow key={g.label} group={g} />
                  ))}
                </div>
                <AudienceLineChart groups={age.groups} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
