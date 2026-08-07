import { postDatalab } from "./datalabClient";
import { computeTrendDirection, type TrendDirection } from "./trendDirection";
import { CATEGORY_CID_MAP } from "./datalabCategories";
import { createTtlCache } from "../utils/ttlCache";

// 2026-08 추가(사용자 요청 — "네이버 쇼핑 상위 10개 제품 정보를 카드로
// 표기") — 실제 상품 검색 API는 클래식 오픈API·NAVER API HUB 둘 다 더 이상
// 제공하지 않고(실측 확인: openapi.naver.com/v1/search/shop은 "존재하지
// 않는 검색 api" 에러, API HUB 문서에도 개별 상품 검색은 없고 쇼핑인사이트
// 뿐임), 스크래핑도 첫 요청부터 네이버가 봇으로 감지해 차단하는 걸 실측
// 확인해서(§CLAUDE.md 10.3 "네이버 통합검색"과 같은 이유로 제외) 대안으로
// 이미 있는 쇼핑인사이트(카테고리 단위 관심도)를 개인 키워드 도구 결과
// 페이지에 참고로 보여주기로 함(사용자 승인 — "맞는 카테고리일 때만
// 조용히 보여주고 나머지는 숨김"). CID가 임의 키워드→카테고리 매핑 API가
// 없는 것과 같은 이유로, 사용자가 입력한 자유 키워드를 CATEGORY_CID_MAP의
// 4개 카테고리(패션/뷰티/헬스운동/여행) 중 하나에 매칭하는 것도 공식
// API가 없어 휴리스틱 키워드 목록으로 근사함 — 매칭 안 되면 null(그
// 카테고리가 아니라는 뜻이 아니라 "이 4개 중 확실히 아는 카테고리가
// 아니다"라는 뜻, 그 경우 프론트가 조용히 섹션을 숨김).
const CATEGORY_KEYWORD_HINTS: Record<string, string[]> = {
  fashion: [
    "옷", "의류", "티셔츠", "니트", "청바지", "원피스", "자켓", "재킷", "코트", "패딩",
    "맨투맨", "후드", "블라우스", "스커트", "치마", "정장", "가디건", "조끼",
    "신발", "구두", "스니커즈", "운동화", "부츠", "샌들", "슬리퍼",
    "가방", "백팩", "지갑", "벨트", "모자", "액세서리", "귀걸이", "목걸이",
  ],
  beauty: [
    "화장품", "스킨케어", "크림", "선크림", "선블록", "로션", "에센스", "세럼",
    "립스틱", "틴트", "파운데이션", "쿠션", "블러셔", "아이섀도", "마스카라",
    "향수", "샴푸", "린스", "트리트먼트", "클렌징", "마스크팩", "필링",
  ],
  fitness: [
    "운동", "헬스", "요가", "필라테스", "런닝화", "런닝머신", "덤벨", "바벨",
    "단백질", "프로틴", "보충제", "등산", "등산화", "캠핑", "텐트", "자전거",
    "골프", "골프채", "테니스", "배드민턴", "축구화", "농구화", "수영복", "요가매트",
  ],
  travel: [
    "여행", "항공권", "비행기표", "호텔", "숙소", "펜션", "리조트", "캐리어",
    "여행가방", "여권", "국내여행", "해외여행", "패키지여행", "게스트하우스",
  ],
};

// 첫 매칭 카테고리를 반환 — 키워드가 여러 카테고리 힌트에 동시에 걸리는
// 경우는 드물지만, 순서(위 객체 선언 순서)로 결정론적으로 처리함.
export function matchShoppingCategory(keyword: string): string | null {
  for (const [categoryId, hints] of Object.entries(CATEGORY_KEYWORD_HINTS)) {
    if (hints.some((hint) => keyword.includes(hint))) return categoryId;
  }
  return null;
}

const TREND_WINDOW_MONTHS = 3;
const CACHE_TTL_MS = 60 * 60 * 1000; // categoryTrends.ts와 동일한 1시간

interface ShoppingCategoryTrendResponse {
  results: { data: { period: string; ratio: number }[] }[];
}

const cache = createTtlCache<string, TrendDirection | null>(CACHE_TTL_MS);

function threeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - TREND_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// CID 매핑이 있는 4개 카테고리(패션/뷰티/헬스·운동/여행)만 실제 값을 반환.
// 나머지는 undefined — "쇼핑 데이터 없음"을 지어내지 않고 프론트가 그 섹션을
// 아예 안 그리게 하기 위한 구분(null과 다름: null은 "조회했지만 방향을 말할
// 수 없음", undefined는 "애초에 조회 대상이 아님").
export async function getCategoryShoppingDirection(
  categoryId: string
): Promise<TrendDirection | null | undefined> {
  const mapping = CATEGORY_CID_MAP[categoryId];
  if (!mapping) return undefined;

  const cached = cache.get(categoryId);
  if (cached !== undefined) return cached;

  const data = await postDatalab<ShoppingCategoryTrendResponse>("/categories", {
    startDate: threeMonthsAgo(),
    endDate: today(),
    timeUnit: "month",
    category: [{ name: mapping.label, param: [mapping.cid] }],
    device: "",
    gender: "",
    ages: [],
  });

  const direction = computeTrendDirection(data.results[0]?.data ?? []);
  cache.set(categoryId, direction);
  return direction;
}
