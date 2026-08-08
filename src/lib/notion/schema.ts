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
  // 2026-07 추가 — 지역·플레이스 노출순위 조회용(섹션 10.3.2 참고). 네이버
  // 공식 지역검색 API는 블로그 URL이 아니라 업체명으로 매칭하므로 별도 필드로
  // 받음. 선택 입력이라 없으면 지역·플레이스 진단 카드만 빈 상태로 보임.
  businessName: "업체명",
  // 2026-07 추가 — 지역·플레이스 노출순위를 경쟁 업체와도 비교할 수 있도록
  // competitorDomains와 같은 패턴(콤마 구분 텍스트)으로 별도 수집.
  competitorBusinessNames: "비교 업체명 목록",
  // 2026-08 추가(사용자 요청 — "숫자 지표를 AI가 자연어로 요약해줬으면") —
  // 세션 생성 시점에 Claude가 한 번 생성해서 고정하는 짧은 텍스트 요약.
  // gapSummary(부족 항목, 규칙 기반 템플릿)와 달리 실제 자연어 문장이고
  // 비교 블로그가 없어도 생성됨. `insightReport.ts` 참고.
  insightReport: "AI 인사이트",
} as const;

// 2026-07 블로그 지수 산정 방식 전면 개편(검색 상위노출·게시글수·댓글수·
// 공감수·공유수 5개 축) — 사용자 요청으로 예전 키워드 커버리지 중심 산정을
// 대체함. keywordCoverage/highVolumeCoverage/lowCompetitionCoverage/
// freshness 4개 속성은 더 이상 코드에서 안 쓰지만, Notion 쪽 기존 데이터는
// 건드리지 않고 그대로 둠(레거시 컬럼, additive-only 마이그레이션 원칙).
// postVolume 속성은 이름·Notion 컬럼은 그대로 두고 의미만 "키워드 매칭
// 게시물 수"에서 "게시글 수 축 점수(실제 총 포스팅 수 기준)"로 바뀜.
export const BLOG_SCORE_RECORD_PROPS = {
  title: "도메인",
  label: "라벨",
  isMine: "내 블로그 여부",
  session: "소속 세션",
  compositeScore: "종합점수",
  postVolume: "콘텐츠량",
  keywordCoverage: "키워드 커버리지", // 레거시, 더 이상 안 씀
  highVolumeCoverage: "고검색량 공략도", // 레거시, 더 이상 안 씀
  lowCompetitionCoverage: "저경쟁 공략도", // 레거시, 더 이상 안 씀
  exposureRank: "평균 노출순위",
  freshness: "콘텐츠 최신성", // 레거시, 더 이상 안 씀
  engagement: "사용자 반응",
  category: "카테고리",
  todayVisitor: "최근 방문자",
  totalVisitor: "총 방문자",
  subscriberCount: "이웃 수",
  postCount: "총 포스팅",
  avgRecentComments: "최근 댓글수",
  avgRecentReactions: "최근 공감수",
  avgRecentShares: "최근 공유수",
  reactionScore: "공감수 점수",
  shareScore: "공유수 점수",
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

// AI 블로그 글쓰기(`/write`)·게시판용 계정 — 로그인 없는 이 사이트에서
// 유일하게 계정이 필요한 기능들(CLAUDE.md §16: 유료 Claude API 남용 방지
// 목적). sessionToken은 로그인 시 매번 새로 발급(1계정 1세션만 유지 — 여러
// 기기 동시 로그인 지원 안 함, MVP 범위). authProvider/providerId는
// 네이버·카카오·구글 소셜 로그인용 — 발급처가 이미 신원을 확인한 것이라
// emailVerified가 가입 즉시 true로 세팅됨. providerId로 재로그인 시 계정을
// 찾음(이메일이 안 바뀌어도, 혹은 제공 안 돼도 안전하게 매칭하기 위함).
// **2026-08부터 이메일+비밀번호 가입/로그인은 완전히 제거되고 소셜 로그인
// 3종만 남음**(사용자 요청 — 소셜은 이미 이메일 인증 없이 바로 가입되는데
// 이메일+비밀번호만 별도 인증 절차를 거치게 하는 게 일관성이 없다는 이유,
// `src/lib/auth/session.ts`·`src/lib/notion/users.ts` 참고) — `비밀번호해시`/
// `인증토큰` 두 속성은 이제 아무 코드도 안 쓰지만, Notion 컬럼 자체는
// additive-only 원칙에 따라 그대로 남겨둠(레거시, 옛 이메일+비밀번호 계정의
// 흔적일 뿐).
export const USER_PROPS = {
  title: "이메일",
  passwordHash: "비밀번호해시", // 레거시, 더 이상 안 씀
  emailVerified: "이메일인증됨",
  verificationToken: "인증토큰", // 레거시, 더 이상 안 씀
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
  // 2026-08 추가(게시판 기능) — 로그인용 "이메일"을 그대로 공개 표시하면
  // 개인정보 노출이라(카카오 무이메일 계정은 애초에 이 자리에 임시 표시
  // 이름이 들어가긴 하지만, 이메일/네이버 계정은 진짜 이메일이 그대로 들어감)
  // 게시판 글·댓글에 보일 별도의 공개용 닉네임 필드. 없으면 최초 게시글
  // 작성 시점에 설정을 요구함(scripts/add-user-nickname-prop.ts로 마이그레이션).
  nickname: "닉네임",
} as const;

export const AUTH_PROVIDER = {
  email: "이메일",
  naver: "네이버",
  kakao: "카카오",
  google: "구글",
} as const;

// 게시판(`/board`, 2026-08 추가) — 자유게시판. 작성자는 relation이 아니라
// 작성 시점 닉네임 스냅샷(rich_text)으로 저장 — 이 프로젝트가 이미 여러
// 곳에서 쓰는 "조회 시점이 아니라 작성/생성 시점 값을 고정" 패턴과 동일
// (예: 블로그지수 결과가 세션 생성 시점에 고정되는 것). 작성자ID는 relation
// 없이도 나중에 "내 글만 보기" 같은 기능을 붙일 수 있도록 사용자 페이지
// id만 별도로 남겨둠(지금은 안 씀).
export const BOARD_POST_PROPS = {
  title: "제목",
  body: "본문",
  authorNickname: "작성자닉네임",
  authorId: "작성자ID",
  images: "이미지",
  createdAt: "작성일시",
  // 게시판 댓글 DB의 "소속게시글" relation을 dual_property로 만들 때 Notion이
  // 이 데이터소스에 자동 생성해준 역방향 relation(setup-notion-board.ts의
  // renameAutoRelation이 "댓글"로 이름 붙임) — 별도 쿼리 없이 게시글을 읽을
  // 때 이 relation 배열 길이로 댓글 수를 바로 알 수 있음(목록 카드의 댓글
  // 수 표시용, 2026-08 추가). Notion이 relation을 페이지당 최대 25개까지만
  // 내려주는 제약이 있어 댓글이 25개를 넘는 글은 실제보다 적게 셀 수 있음
  // — 이 정도 규모의 게시판에선 무시할 만한 근사치로 판단.
  commentCount: "댓글",
  // 2026-08 추가 — Notion의 작성일시(created_time)는 API로 과거 시점을
  // 지정할 수 없는 읽기 전용 속성이라(실측 확인), 시드/이관 등으로 과거
  // 시점의 글을 넣어야 할 때를 대비해 별도 date 속성을 둠. 이 값이 있으면
  // 항상 이 값을 표시·정렬 기준으로 쓰고, 없으면(과거에 만들어진 글) 기존
  // created_time으로 폴백함 — 새 글은 API가 항상 이 값도 현재 시각으로
  // 같이 채움(scripts/add-board-posted-at-prop.ts로 마이그레이션).
  postedAt: "표시일시",
} as const;

export const BOARD_COMMENT_PROPS = {
  // Notion 데이터베이스는 title 속성이 반드시 1개 있어야 해서 댓글 내용을
  // title로 씀(별도 "내용" rich_text를 안 둠 — 중복 저장 방지).
  title: "내용",
  authorNickname: "작성자닉네임",
  post: "소속게시글",
  createdAt: "작성일시",
  // BOARD_POST_PROPS.postedAt과 같은 이유·같은 패턴.
  postedAt: "표시일시",
} as const;

// AI 블로그 자동글쓰기 히스토리(`/write/history`, 2026-08 추가, 사용자 요청 —
// "게시에 적용한 글들을 히스토리로 저장하고, 그걸 기반으로 앞으로 스타일을
// 미리 정해줬으면"). "이 버전으로 확정하기" 클릭 시점에 1건씩 쌓임(BOARD_POST_PROPS와
// 동일하게 작성자는 relation이 아니라 작성 시점 ID·닉네임 스냅샷). 유형은
// select — Notion select는 미리 존재하는 옵션만 쓸 수 있어서(§16 구글 로그인
// select 옵션 버그와 같은 함정) setup 스크립트가 16개 BlogCategory id를 전부
// 옵션으로 미리 만들어둬야 함.
export const WRITE_HISTORY_PROPS = {
  title: "제목",
  body: "본문",
  authorId: "작성자ID",
  authorNickname: "작성자닉네임",
  category: "유형",
  sponsored: "협찬여부",
  tags: "태그",
  stylePreset: "스타일프리셋",
  layout: "레이아웃",
  accentColor: "강조색상",
  font: "폰트",
  // BOARD_POST_PROPS.createdAt과 같은 패턴 — Notion `created_time` 타입
  // 속성이라 값을 직접 안 써도 페이지 생성 시 자동으로 채워짐(읽기 전용).
  createdAt: "적용일시",
} as const;
