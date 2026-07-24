export const SESSION_PROPS = {
  title: "세션명",
  keyword: "검색 키워드",
  searchedAt: "검색일시",
  resultCount: "결과 개수",
  relatedRecords: "관련 레코드",
} as const;

export const RECORD_PROPS = {
  title: "키워드",
  kind: "구분",
  session: "소속 세션",
  pcCount: "PC 월간검색수",
  mobileCount: "모바일 월간검색수",
  totalCount: "합계 검색수",
  compIdx: "경쟁정도",
  avgAdDepth: "월평균노출광고수",
  totalBlogPosts: "총 블로그 발행량",
  monthlyBlogPosts: "월간 블로그 발행량",
  blogSaturation: "블로그 포화도",
  checkedAt: "조회일시",
} as const;

export const KEYWORD_KIND = {
  seed: "시드 키워드",
  related: "연관 키워드",
  // Not from Naver's own related-keyword suggestions — backfilled by
  // combining a sparse seed with common modifiers and re-querying real
  // search-volume data (see keywordExpansion.ts).
  inferred: "추론 키워드",
} as const;

// 블로그지수 — ad-hoc (no saved "business") 도메인 비교 조회 세션.
export const BLOG_SCORE_SESSION_PROPS = {
  title: "세션명",
  myBlogDomain: "내 블로그 도메인",
  competitorDomains: "비교 블로그 목록",
  keywords: "키워드 목록",
  searchedAt: "조회일시",
  gapSummary: "부족 항목",
  relatedRecords: "관련 레코드",
} as const;

export const BLOG_SCORE_RECORD_PROPS = {
  title: "도메인",
  label: "라벨",
  isMine: "내 블로그 여부",
  session: "소속 세션",
  compositeScore: "종합점수",
  postVolume: "콘텐츠량",
  keywordCoverage: "키워드 커버리지",
  highVolumeCoverage: "고검색량 공략도",
  lowCompetitionCoverage: "저경쟁 공략도",
  exposureRank: "평균 노출순위",
  freshness: "콘텐츠 최신성",
  engagement: "사용자 반응",
  category: "카테고리",
  todayVisitor: "최근 방문자",
  totalVisitor: "총 방문자",
  subscriberCount: "이웃 수",
  postCount: "총 포스팅",
  avgRecentComments: "최근 댓글수",
  topTerms: "자주 쓰는 단어",
  checkedAt: "조회일시",
} as const;

// 문의하기 (`/contact`) — 사이트 문의 접수 기록. 이메일 발송(Resend)과 별개로
// Notion에도 남겨 이메일 발송 실패 시에도 문의 내용이 유실되지 않게 함.
export const INQUIRY_PROPS = {
  title: "제목",
  name: "이름",
  email: "이메일",
  message: "문의내용",
  handled: "처리완료",
  receivedAt: "접수일시",
} as const;
