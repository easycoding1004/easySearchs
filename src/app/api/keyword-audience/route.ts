import { NextResponse } from "next/server";
import { fetchSearchTrend, type TrendDataPoint } from "@/lib/naver/datalabSearchClient";
import { computeTrendDirection, type TrendDirection } from "@/lib/naver/trendDirection";
import {
  groupsForDimension,
  type AudienceDimension,
} from "@/lib/naver/audienceGroups";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { NAVER_OPENAPI_CONCURRENCY } from "@/lib/constants";
import { getErrorMessage } from "@/lib/utils/errors";

const TREND_WINDOW_MONTHS = 3;
const VALID_DIMENSIONS: AudienceDimension[] = ["gender", "device", "age"];

function threeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - TREND_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// 성별/기기/연령 각 그룹은 자기 구간 안에서 독립적으로 0~100 재정규화되기
// 때문에(실측 확인, audienceGroups.ts 참고) 그룹 간 크기 비교는 근거가 없다.
// 방향(상승/보합/하락)과 함께 원본 기간별 지수(data)도 그대로 반환하는데,
// 이건 KeywordAudiencePanel.tsx가 그룹별 "추세 모양"을 꺾은선 그래프로
// 그리기 위함 — 사용자가 그룹 간 겹친 그래프로 보여달라고 명시적으로
// 요청해서 반영함(2026-07). 정규화 특성상 그룹 간 크기 비교는 여전히
// 근거가 없다는 점을 화면 안내 문구로 계속 명시할 것.
export async function POST(request: Request) {
  let keyword: string;
  let dimension: AudienceDimension;
  try {
    const body = await request.json();
    keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
    dimension = body.dimension;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!keyword) {
    return NextResponse.json({ error: "keyword가 필요합니다." }, { status: 400 });
  }
  if (!VALID_DIMENSIONS.includes(dimension)) {
    return NextResponse.json({ error: "dimension이 올바르지 않습니다." }, { status: 400 });
  }

  const groups = groupsForDimension(dimension);
  const startDate = threeMonthsAgo();
  const endDate = today();

  try {
    const results = await mapWithConcurrency(
      groups,
      NAVER_OPENAPI_CONCURRENCY,
      async (
        group
      ): Promise<{ label: string; direction: TrendDirection | null; data: TrendDataPoint[] }> => {
        try {
          const trend = await fetchSearchTrend(
            [{ groupName: group.label, keywords: [keyword] }],
            startDate,
            endDate,
            "month",
            { device: group.device, gender: group.gender, ages: group.ages }
          );
          const data = trend.results[0]?.data ?? [];
          return {
            label: group.label,
            direction: computeTrendDirection(data),
            data,
          };
        } catch (err) {
          console.error(
            `[POST /api/keyword-audience] failed for "${keyword}" / ${group.label}:`,
            err
          );
          return { label: group.label, direction: null, data: [] };
        }
      }
    );
    return NextResponse.json({ groups: results });
  } catch (err) {
    const message = getErrorMessage(err);
    console.error("[POST /api/keyword-audience] failed:", message, err);
    return NextResponse.json({ error: `조회에 실패했습니다: ${message}` }, { status: 502 });
  }
}
