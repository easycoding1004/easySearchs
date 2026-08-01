import { NextResponse } from "next/server";
import { fetchKeywordStats } from "@/lib/naver/client";
import { upsertSnapshot } from "@/lib/notion/keywordSnapshots";
import { SNAPSHOT_SOURCE } from "@/lib/notion/schema";
import { createTtlCache } from "@/lib/utils/ttlCache";
import { getErrorMessage } from "@/lib/utils/errors";
import type { NormalizedKeywordRow } from "@/lib/naver/types";

// 크롬 확장(우클릭 조회/팝업/주소창 검색, 2026-08 추가)이 쓰는 경량 조회
// 엔드포인트 — 웹앱의 /api/search와 의도적으로 분리함:
// - /api/search는 세션+레코드를 Notion에 저장하고 블로그 발행량까지 조회하는
//   무거운 흐름(검색 버튼 클릭이라는 명시적 행동 1번당 1번 실행되는 걸 전제).
//   확장은 우클릭 1번, 주소창 입력 1번마다 훨씬 잦게 호출될 수 있어서 그대로
//   재사용하면 Notion 검색 세션 DB가 확장 사용으로 도배되고 /admin 통계도
//   왜곡됨 — 그래서 Notion 세션 저장은 하지 않음.
// - fetchKeywordStats가 호출하는 네이버 검색광고 API(client.ts)는 오픈API
//   공유 스로틀(throttle.ts)과 별개 상품이라 지금까지 별도 제한이 없었음 —
//   여태 사람이 검색 버튼을 누르는 속도로만 호출돼서 문제없었지만, 확장은
//   우클릭 한 번에도 순간적으로 여러 번 호출될 수 있는 사용 패턴이라 짧은
//   TTL 캐시로 같은 키워드 반복 조회를 흡수함(레이트리밋 보호 겸 체감 속도
//   개선) — 사용량이 늘면 이 캐시만으론 부족할 수 있으니 실사용 지표를 보고
//   재검토할 것.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = createTtlCache<string, LookupResult>(CACHE_TTL_MS);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface LookupResult {
  keyword: string;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
  compIdx: string | null;
  related: NormalizedKeywordRow[];
}

function normalizeForMatch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let keyword: string;
  try {
    const body = await request.json();
    keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400, headers: CORS_HEADERS });
  }

  if (!keyword) {
    return NextResponse.json({ error: "키워드를 입력해 주세요." }, { status: 400, headers: CORS_HEADERS });
  }

  const cacheKey = normalizeForMatch(keyword);
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: CORS_HEADERS });
  }

  try {
    // hintKeywords 파라미터는 공백이 섞이면 400 에러(실측 확인, /api/search와
    // 동일한 이슈) — 네이버 호출에만 공백 제거한 버전을 씀.
    const rows = await fetchKeywordStats(keyword.replace(/\s+/g, ""));
    if (rows.length === 0) {
      return NextResponse.json({ error: "검색 결과가 없습니다." }, { status: 404, headers: CORS_HEADERS });
    }

    const target = normalizeForMatch(keyword);
    const seed = rows.find((r) => normalizeForMatch(r.relKeyword) === target) ?? rows[0];
    const related = rows.filter((r) => r !== seed).slice(0, 10);

    const result: LookupResult = {
      keyword: seed.relKeyword,
      monthlyPcQcCnt: seed.monthlyPcQcCnt,
      monthlyMobileQcCnt: seed.monthlyMobileQcCnt,
      compIdx: seed.compIdx,
      related,
    };
    cache.set(cacheKey, result);

    // /trending의 자체 스냅샷 축적에 편승(best-effort, 응답을 막지 않음) —
    // /api/search가 검색할 때마다 하는 것과 같은 패턴(upsertSnapshot).
    upsertSnapshot(
      seed.relKeyword,
      seed.monthlyPcQcCnt,
      seed.monthlyMobileQcCnt,
      SNAPSHOT_SOURCE.userSearch
    ).catch((err) => {
      console.error("[POST /api/extension/keyword-lookup] snapshot upsert failed:", getErrorMessage(err));
    });

    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (err) {
    const message = getErrorMessage(err);
    console.error("[POST /api/extension/keyword-lookup] failed:", message, err);
    return NextResponse.json({ error: `조회에 실패했습니다: ${message}` }, { status: 502, headers: CORS_HEADERS });
  }
}
