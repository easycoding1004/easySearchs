// 2026-08 — 사용자 요청으로 AI 블로그 자동글쓰기(`/write`)를 임시로
// "개발중" 상태로 표시. 이 플래그 하나로 진입점(SiteHeader/MobileNavMenu/
// FeatureShowcase)의 버튼·아이콘을 비활성화하고 "개발중" 배지를 붙이며,
// /write 페이지 자체도 폼 대신 안내 문구만 보여줌. 준비되면 true로 되돌릴 것
// — 그 외 코드(라우트·컴포넌트) 자체는 그대로 남겨둠.
export const AI_WRITE_ENABLED = false;

// 2026-08 재설계(1단계) — 핫딜정보는 세 타겟(소상공인·프리랜서·블로거)의
// 문제와 직접 관련이 없는 소비자용 콘텐츠라 노출을 종료하기로 사용자와
// 확정함(자동수집도 배포 환경 네트워크 차단으로 이미 중단된 상태였음).
// 데이터(Notion DB)·코드는 전부 보존 — 이 플래그 하나로 /hotdeal 페이지
// 3개와 등록/댓글 API, mypage의 핫딜 섹션이 함께 잠김. 되살리려면 true로.
export const HOTDEAL_ENABLED = false;

export const MAX_KEYWORD_RESULTS = 50;
export const NOTION_WRITE_CONCURRENCY = 3;
// Naver's keywordstool API accepts at most 5 comma-separated hintKeywords per call.
export const MAX_SEED_KEYWORDS = 5;
// Notion's query index can lag a moment behind a just-created page — poll
// until the new records are actually queryable before sending the user to
// the result page, instead of making them refresh to see complete data.
export const INDEX_WAIT_MAX_ATTEMPTS = 6;
export const INDEX_WAIT_DELAY_MS = 400;

// Kept at 1 — openApiClient.ts also throttles every outgoing request to a
// minimum spacing, and concurrency > 1 would race against that throttle.
export const NAVER_OPENAPI_CONCURRENCY = 1;

// 블로그지수 (ad-hoc, Notion-backed — no saved "business").
export const MAX_BLOG_SCORE_KEYWORDS = 30;
export const MAX_BLOG_SCORE_COMPETITORS = 10;

// 검색량 급상승 (`/trending`).
export const TRENDING_NAVER_MATCH_CONCURRENCY = 3;
export const SNAPSHOT_JOB_CONCURRENCY = 2;
export const SNAPSHOT_JOB_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12시간
export const RISING_KEYWORD_MIN_DAYS = 20;

// 급상승 키워드 이메일 다이제스트 발송 주기 — snapshotJob과 같은 방식(순수
// setInterval, 시작 시 즉시 실행 안 함)이라 서버가 이 주기보다 자주
// 재배포되면 발송이 안 나갈 수 있음(정직한 트레이드오프, CLAUDE.md §6.4 참고).
export const NEWSLETTER_JOB_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7일
export const NEWSLETTER_SEND_CONCURRENCY = 3;

// 검색 트렌드 방향성 배지 (`TrendDirectionBadge`) — 키워드당 데이터랩 호출
// 1회라 개인 도구(시드 최대 5개)는 그대로 다 보내지만, 블로그지수(최대 30개)
// 쪽은 이미 느린 라이브 탭이 더 느려지지 않도록 상한을 둠.
export const MAX_TREND_BADGE_KEYWORDS = 10;

// 토스페이먼츠 월 구독제 정기 청구 잡 — newsletterJob과 같은 방식(순수
// setInterval, 서버 시작 시 즉시 실행 안 함: 매 배포마다 카드가 청구되면
// 안 되므로). 하루 1회면 "다음결제일<=오늘" 판정을 놓치지 않기에 충분함.
export const BILLING_JOB_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1일
export const BILLING_JOB_CONCURRENCY = 2;

// 소상공인 정책정보 게시판 — 기업마당 공고를 매일 훑어 자동 게시.
// snapshotJob과 같은 패턴(서버 시작 시 즉시 1회 + 이후 주기) — billingJob과
// 달리 즉시 실행해도 돈이 나가는 게 아니라 콘텐츠가 빨리 채워지는 것뿐이라
// 안전함. setInterval 기반이라 "매일 아침"처럼 특정 시각을 보장하진 않고
// 서버가 켜진 시점 기준 24시간마다 도는 것 — newsletterJob과 동일한
// 트레이드오프.
export const POLICY_BOARD_JOB_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1일
export const POLICY_BOARD_JOB_CONCURRENCY = 2;

// 핫딜정보 게시판 — 루리웹 핫딜/예판 게시판 공식 RSS를 1시간마다 훑어 자동
// 게시(사용자 요청). policyBoardJob과 같은 이유로 서버 시작 시 즉시 1회도
// 실행함(돈이 나가는 잡이 아님).
export const HOTDEAL_CRAWL_JOB_INTERVAL_MS = 60 * 60 * 1000; // 1시간
export const HOTDEAL_CRAWL_JOB_CONCURRENCY = 2;

// 관심 키워드 구독 + 변화 알림(2026-08 추가, 제품 감사 장기 제안) — 등록
// 시점(또는 마지막 알림 시점) 대비 검색량이 이 비율 이상 변하면 이메일로
// 알림. newsletterJob/billingJob과 같은 이유로 서버 시작 시 즉시 실행 안
// 함(재배포마다 회원에게 메일이 나가면 안 되므로). 하루 1회면 충분.
export const KEYWORD_WATCH_JOB_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1일
export const KEYWORD_WATCH_CHANGE_THRESHOLD = 0.2; // ±20%
// 네이버 검색광고 키워드도구 API는 hintKeywords를 한 번에 최대 5개까지만
// 받음(§ MAX_SEED_KEYWORDS와 같은 제약) — 여러 회원의 관심 키워드를 모아
// 조회할 때도 이 크기로 묶어서 호출.
export const KEYWORD_WATCH_BATCH_SIZE = 5;
export const KEYWORD_WATCH_JOB_CONCURRENCY = 3;
