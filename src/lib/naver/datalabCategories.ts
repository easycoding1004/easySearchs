// 홈페이지 카테고리(categoryTrends.ts의 CATEGORIES)를 데이터랩 쇼핑인사이트
// 카테고리 ID(CID)에 매핑 — 실측으로 검증된 4개만 채움. 네이버가 임의
// 키워드→쇼핑카테고리 매칭 API를 안 줘서 8개 전부를 신뢰성 있게 채울 수
// 없고, 아래 4개를 제외한 나머지는 애초에 소매 상품 카테고리가 아니거나
// (외식·맛집/카페·디저트/교육 — 쇼핑으로 안 팔리는 서비스업) CID를
// 확정하지 못함(반려동물 — 후보 CID 2개 실측 시도했으나 데이터 없음).
// 새 카테고리를 추가하려면 반드시 실제 API 응답으로 CID를 확인한 뒤에만
// 이 맵에 추가할 것 — 추측 금지(CLAUDE.md 원칙).
export const CATEGORY_CID_MAP: Partial<Record<string, { cid: string; label: string }>> = {
  fashion: { cid: "50000000", label: "패션의류" },
  beauty: { cid: "50000002", label: "화장품/미용" },
  fitness: { cid: "50000007", label: "스포츠/레저" },
  travel: { cid: "50000009", label: "여가/생활편의" },
};
