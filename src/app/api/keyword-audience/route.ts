import { NextResponse } from "next/server";
import { fetchSearchTrend } from "@/lib/naver/datalabSearchClient";
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
// 때문에(실측 확인, audienceGroups.ts 참고) 그룹 간 크기 비교는 근거가 없다
// — 그래서 크기가 아니라 그룹별 "최근 3개월 추세 방향"만 반환한다.
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
      async (group): Promise<{ label: string; direction: TrendDirection | null }> => {
        try {
          const trend = await fetchSearchTrend(
            [{ groupName: group.label, keywords: [keyword] }],
            startDate,
            endDate,
            "month",
            { device: group.device, gender: group.gender, ages: group.ages }
          );
          return {
            label: group.label,
            direction: computeTrendDirection(trend.results[0]?.data ?? []),
          };
        } catch (err) {
          console.error(
            `[POST /api/keyword-audience] failed for "${keyword}" / ${group.label}:`,
            err
          );
          return { label: group.label, direction: null };
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
