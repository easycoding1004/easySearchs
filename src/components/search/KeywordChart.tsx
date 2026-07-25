"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KeywordRecord } from "@/lib/notion/types";
import KeywordBlogModal from "./KeywordBlogModal";

const BAR_SIZE = 24;
const MIN_WIDTH_PER_BAR = 72;

interface ChartDatum {
  keyword: string;
  isSeed: boolean;
  pcCount: number;
  mobileCount: number;
  totalCount: number;
}

function CustomTick({
  x,
  y,
  payload,
  data,
}: {
  x: number;
  y: number;
  payload: { value: string };
  data: ChartDatum[];
}) {
  const datum = data.find((d) => d.keyword === payload.value);
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={12}
      fontWeight={datum?.isSeed ? 700 : 400}
      fill="var(--chart-text-secondary)"
    >
      {payload.value}
    </text>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const pc = payload.find((p) => p.dataKey === "pcCount")?.value ?? 0;
  const mobile = payload.find((p) => p.dataKey === "mobileCount")?.value ?? 0;

  return (
    <div
      style={{
        background: "var(--chart-surface)",
        border: "1px solid var(--chart-gridline)",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--chart-text-primary)", fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: "var(--chart-text-secondary)" }}>
        PC: {pc.toLocaleString()}
      </div>
      <div style={{ color: "var(--chart-text-secondary)" }}>
        모바일: {mobile.toLocaleString()}
      </div>
      <div style={{ color: "var(--chart-text-primary)", fontWeight: 600, marginTop: 4 }}>
        합계: {(pc + mobile).toLocaleString()}
      </div>
    </div>
  );
}

export default function KeywordChart({ records }: { records: KeywordRecord[] }) {
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  const data: ChartDatum[] = records.map((record) => ({
    keyword: record.keyword,
    isSeed: record.kind === "시드 키워드",
    pcCount: record.pcCount,
    mobileCount: record.mobileCount,
    totalCount: record.totalCount,
  }));

  const width = Math.max(data.length * MIN_WIDTH_PER_BAR, 480);

  // recharts passes the rendered rectangle item, not our datum directly —
  // the original ChartDatum row lives at `.payload`. No onMouseLeave: the
  // modal should stay put once opened (hovering a *different* bar still
  // updates it) so moving the mouse toward the modal to click a link
  // doesn't clear it mid-transit.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarActivate = (item: { payload?: any }) => {
    const keyword = item.payload?.keyword;
    if (typeof keyword === "string") setActiveKeyword(keyword);
  };

  return (
    <div className="w-full rounded-lg border border-hairline bg-surface p-4">
      <div className="overflow-x-auto">
        <div style={{ width, height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
              <CartesianGrid
                vertical={false}
                stroke="var(--chart-gridline)"
                strokeDasharray="0"
              />
              <XAxis
                dataKey="keyword"
                axisLine={{ stroke: "var(--chart-baseline)" }}
                tickLine={false}
                interval={0}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tick={(props: any) => <CustomTick {...props} data={data} />}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--chart-text-muted)" }}
                tickFormatter={(value: number) => value.toLocaleString()}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--chart-gridline)" }} />
              <Legend
                formatter={(value: string) =>
                  value === "pcCount" ? "PC" : "모바일"
                }
                wrapperStyle={{ fontSize: 12, color: "var(--chart-text-secondary)" }}
              />
              <Bar
                dataKey="pcCount"
                stackId="volume"
                fill="var(--chart-series-pc)"
                stroke="var(--chart-surface)"
                strokeWidth={2}
                barSize={BAR_SIZE}
                radius={[0, 0, 0, 0]}
                onMouseEnter={handleBarActivate}
                onClick={handleBarActivate}
              />
              <Bar
                dataKey="mobileCount"
                stackId="volume"
                fill="var(--chart-series-mobile)"
                stroke="var(--chart-surface)"
                strokeWidth={2}
                barSize={BAR_SIZE}
                radius={[4, 4, 0, 0]}
                onMouseEnter={handleBarActivate}
                onClick={handleBarActivate}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <KeywordBlogModal keyword={activeKeyword} onClose={() => setActiveKeyword(null)} />
    </div>
  );
}
