"use client";

import { useEffect, useState } from "react";
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
import type { TrendResponse, TrendTimeUnit } from "@/lib/naver/datalabSearchClient";

const SERIES_COLORS = [
  "var(--chart-series-pc)",
  "var(--chart-series-mobile)",
  "var(--chart-series-tertiary)",
  "var(--chart-series-quaternary)",
  "var(--chart-series-quinary)",
];

type Period = "1m" | "1y" | "custom";

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function today(): Date {
  return new Date();
}

function computeRange(period: Period, customStart: string, customEnd: string) {
  if (period === "1m") {
    const end = today();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);
    return { startDate: fmt(start), endDate: fmt(end), timeUnit: "date" as TrendTimeUnit };
  }
  if (period === "1y") {
    const end = today();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    return { startDate: fmt(start), endDate: fmt(end), timeUnit: "week" as TrendTimeUnit };
  }
  const start = new Date(customStart);
  const end = new Date(customEnd);
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const timeUnit: TrendTimeUnit = diffDays <= 92 ? "date" : diffDays <= 731 ? "week" : "month";
  return { startDate: customStart, endDate: customEnd, timeUnit };
}

interface ChartDatum {
  period: string;
  [group: string]: string | number;
}

function mergeResults(trend: TrendResponse): ChartDatum[] {
  const periods = [
    ...new Set(trend.results.flatMap((r) => r.data.map((d) => d.period))),
  ].sort();

  return periods.map((period) => {
    const datum: ChartDatum = { period };
    for (const result of trend.results) {
      const point = result.data.find((d) => d.period === period);
      if (point) datum[result.title] = point.ratio;
    }
    return datum;
  });
}

export default function SearchTrendPanel({ sessionId }: { sessionId: string }) {
  const [period, setPeriod] = useState<Period>("1m");
  const defaultEnd = fmt(today());
  const defaultStart = (() => {
    const d = today();
    d.setMonth(d.getMonth() - 1);
    return fmt(d);
  })();
  const [customStart, setCustomStart] = useState(defaultStart);
  const [customEnd, setCustomEnd] = useState(defaultEnd);
  // Starts true (not set synchronously in the mount effect below) so the
  // initial fetch doesn't need a setState before its first await —
  // react-hooks/set-state-in-effect flags that pattern.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);

  // No setState before the first `await` — safe to call from the mount/
  // period-change effect below. Callers that need an immediate loading
  // indicator (button clicks) set `loading` themselves first, since that
  // runs in an event handler rather than an effect.
  async function load(period: Period, start: string, end: string) {
    const { startDate, endDate, timeUnit } = computeRange(period, start, end);
    let res: Response;
    let json: unknown;
    try {
      res = await fetch(`/api/session/${sessionId}/trend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, timeUnit }),
      });
      json = await res.json();
    } catch {
      setLoading(false);
      setError("네트워크 오류가 발생했습니다.");
      setTrend(null);
      return;
    }
    setLoading(false);
    if (!res.ok) {
      setError((json as { error?: string }).error ?? "조회에 실패했습니다.");
      setTrend(null);
      return;
    }
    setError(null);
    setTrend(json as TrendResponse);
  }

  useEffect(() => {
    // `load` has no setState before its first await, so this is the
    // standard "fetch on prop/state change" effect react.dev itself
    // documents — react-hooks/set-state-in-effect flags any call to a
    // function that *eventually* calls setState, not just synchronous
    // calls, which makes this a known false positive for async fetchers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (period !== "custom") load(period, customStart, customEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const data = trend ? mergeResults(trend) : [];
  const groupNames = trend ? trend.results.map((r) => r.title) : [];

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border border-hairline bg-surface p-4">
      <div>
        <h2 className="text-base font-semibold text-ink">검색 트렌드 (상대 지수)</h2>
        <p className="text-sm text-ink-muted">
          기간 내 최고점을 100으로 놓은 상대 지수예요. 위 표의 검색수(실제 횟수)와는
          단위가 다르니 나란히 비교하지 마세요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["1m", "1y", "custom"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              if (p !== "custom") setLoading(true);
              setPeriod(p);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ease-spring motion-safe:active:scale-[0.97] ${
              period === p
                ? "bg-primary text-white"
                : "border border-hairline text-ink hover:bg-bg"
            }`}
          >
            {p === "1m" ? "1개월" : p === "1y" ? "1년" : "기간 직접입력"}
          </button>
        ))}

        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customStart}
              min="2016-01-01"
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-9 rounded-sm border border-hairline bg-surface px-2 text-sm text-ink"
            />
            <span className="text-ink-muted">~</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={defaultEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-9 rounded-sm border border-hairline bg-surface px-2 text-sm text-ink"
            />
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                load("custom", customStart, customEnd);
              }}
              disabled={loading}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
            >
              조회
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {loading && <p className="text-sm text-ink-muted">불러오는 중...</p>}

      {!loading && trend && (
        <div className="panel-transition" style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-gridline)" />
              <XAxis
                dataKey="period"
                axisLine={{ stroke: "var(--chart-baseline)" }}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--chart-text-muted)" }}
                minTickGap={24}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--chart-text-muted)" }}
                width={36}
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
              {groupNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
