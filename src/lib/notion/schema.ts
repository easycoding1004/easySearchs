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

// 검색량 급상승 (`/trending`) — 실제 조회된 키워드의 네이버 검색량을 날짜별로
// 쌓아 자체 증감률을 계산하기 위한 스냅샷. 키워드+수집일 조합이 사실상 유니크
// 키(같은 날 중복 검색은 갱신).
export const SNAPSHOT_PROPS = {
  title: "키워드",
  pcCount: "PC 월간검색수",
  mobileCount: "모바일 월간검색수",
  collectedAt: "수집일",
  source: "수집 방식",
} as const;

export const SNAPSHOT_SOURCE = {
  userSearch: "실사용자 검색",
  scheduledJob: "정기 스냅샷",
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

// 관리자 대시보드(`/admin`) 방문자 카운트용 — 미들웨어가 방문자 쿠키가 없는
// 요청에 한해 1행 기록. 방문자당 하루 최대 1행(쿠키가 KST 자정에 만료돼
// 다음날 다시 방문하면 새로 카운트됨).
export const VISIT_PROPS = {
  title: "방문자ID",
  visitedAt: "방문일",
  referrer: "유입경로",
  landingPage: "진입 페이지",
} as const;

// 급상승 키워드 이메일 다이제스트(`/trending`) 구독자 목록.
// unsubscribeToken은 이메일 자체를 키로 구독해지를 받으면 누구나 남의 이메일을
// 해지시킬 수 있어서, 발송 시 개별 발급하는 임의 토큰으로 대신 식별한다.
export const SUBSCRIBER_PROPS = {
  title: "이메일",
  subscribedAt: "구독일",
  unsubscribeToken: "구독해지토큰",
} as const;

// AI 블로그 글쓰기(`/write`)용 계정 — 로그인 없는 이 사이트에서 유일하게 계정이
// 필요한 기능(CLAUDE.md §16: 유료 Claude API 남용 방지 목적). 비밀번호는
// bcrypt 해시만 저장, 평문 저장 안 함. sessionToken은 로그인 시 매번 새로
// 발급(1계정 1세션만 유지 — 여러 기기 동시 로그인 지원 안 함, MVP 범위).
// authProvider/providerId는 네이버·카카오 소셜 로그인용(2026-07 추가) —
// 소셜 로그인은 발급처가 이미 신원을 확인한 것이라 emailVerified가 가입
// 즉시 true로 세팅됨(별도 인증 메일 없음). providerId로 재로그인 시 계정을
// 찾음(이메일이 안 바뀌어도, 혹은 제공 안 돼도 안전하게 매칭하기 위함).
export const USER_PROPS = {
  title: "이메일",
  passwordHash: "비밀번호해시",
  emailVerified: "이메일인증됨",
  verificationToken: "인증토큰",
  sessionToken: "세션토큰",
  sessionIssuedAt: "세션발급일시",
  lastUsedAt: "마지막사용일",
  createdAt: "가입일시",
  authProvider: "가입방식",
  providerId: "소셜ID",
  // "네이버 블로그 글쓰기 열기" 버튼용 — blog.naver.com/{id}의 슬러그.
  // 네이버 로그인 프로필에는 이 값이 없어(오픈API의 id는 앱별 해시일 뿐 블로그
  // 주소와 무관) 계정에 1회 입력받아 저장해두고 재사용함(2026-07 추가).
  naverBlogId: "네이버블로그ID",
} as const;

export const AUTH_PROVIDER = {
  email: "이메일",
  naver: "네이버",
  kakao: "카카오",
} as const;
