import { NextResponse } from "next/server";
import { fetchSearchTrend, type TrendTimeUnit } from "@/lib/naver/datalabSearchClient";
import { getRecordsForSession } from "@/lib/notion/records";
import { getSessionById } from "@/lib/notion/sessions";
import { KEYWORD_KIND } from "@/lib/notion/schema";
import { getErrorMessage } from "@/lib/utils/errors";

// DataLab search-trend earliest queryable date (per Naver's docs).
const EARLIEST_DATE = "2016-01-01";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TIME_UNITS: TrendTimeUnit[] = ["date", "week", "month"];

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await getSessionById(sessionId);
  if (!session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }

  let startDate: string;
  let endDate: string;
  let timeUnit: TrendTimeUnit;
  try {
    const body = await request.json();
    startDate = typeof body.startDate === "string" ? body.startDate : "";
    endDate = typeof body.endDate === "string" ? body.endDate : "";
    timeUnit = body.timeUnit;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return NextResponse.json({ error: "날짜 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (startDate < EARLIEST_DATE || endDate > today || startDate > endDate) {
    return NextResponse.json(
      { error: `조회 기간은 ${EARLIEST_DATE}부터 오늘까지만 가능합니다.` },
      { status: 400 }
    );
  }
  if (!VALID_TIME_UNITS.includes(timeUnit)) {
    return NextResponse.json({ error: "잘못된 timeUnit입니다." }, { status: 400 });
  }

  const records = await getRecordsForSession(sessionId);
  const seedKeywords = [
    ...new Set(
      records.filter((r) => r.kind === KEYWORD_KIND.seed).map((r) => r.keyword)
    ),
  ].slice(0, 5);

  if (seedKeywords.length === 0) {
    return NextResponse.json({ error: "시드 키워드가 없습니다." }, { status: 400 });
  }

  try {
    const trend = await fetchSearchTrend(
      seedKeywords.map((keyword) => ({ groupName: keyword, keywords: [keyword] })),
      startDate,
      endDate,
      timeUnit
    );
    return NextResponse.json(trend);
  } catch (err) {
    const message = getErrorMessage(err);
    console.error("[POST /api/session/[sessionId]/trend] failed:", message, err);
    return NextResponse.json(
      { error: `검색 트렌드 조회에 실패했습니다: ${message}` },
      { status: 502 }
    );
  }
}
