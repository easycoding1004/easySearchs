import type { TrendDataPoint } from "./datalabSearchClient";

export type TrendDirection = "상승" | "보합" | "하락";

const CHANGE_THRESHOLD = 0.1; // ±10% 미만은 "보합"

// 구간 전반부/후반부 평균 비율을 비교 — 단일 시작/끝점 비교보다 노이즈에 덜
// 흔들림. 데이터가 2건 미만이면 방향을 말할 수 없어 null.
export function computeTrendDirection(data: TrendDataPoint[]): TrendDirection | null {
  if (data.length < 2) return null;

  const mid = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, Math.max(mid, 1));
  const secondHalf = data.slice(mid);

  const avg = (points: TrendDataPoint[]) =>
    points.reduce((sum, p) => sum + p.ratio, 0) / points.length;

  const before = avg(firstHalf);
  const after = avg(secondHalf);
  if (before <= 0) return null;

  const change = (after - before) / before;
  if (change > CHANGE_THRESHOLD) return "상승";
  if (change < -CHANGE_THRESHOLD) return "하락";
  return "보합";
}
