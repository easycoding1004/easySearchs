# CLAUDE.md — ezzsearch (네이버 키워드 검색량 조회 & 블로그지수)

이 문서는 이 프로젝트에서 작업할 때 참고하는 지침서입니다.

**화면에 보이는 브랜드명은 "이지서치"(2026-07 변경)** — 도메인(`ezzsearch.com`)과 이메일 발송 주소(`contact@`/`trending@ezzsearch.com`)는 그대로 유지하기로 사용자와 확정했으므로, 코드/파일명/라우트/도메인/이 문서 전반에서는 계속 "ezzsearch"를 기술적 식별자로 씀. 화면에 실제로 노출되는 텍스트(타이틀, 메타 설명, JSON-LD `name`, 푸터 저작권, OG 이미지, 임베드 배지, 이메일 발신자 표시명 등)만 "이지서치"로 바뀐 것 — 새 사용자 노출 텍스트를 추가할 때 "ezzsearch"가 아니라 "이지서치"를 쓸 것. 단, 헤더 로고(`ezzsearch_logo.png`)는 텍스트가 아니라 래스터 이미지라 "ezzsearch" 워드마크가 그대로 남아있음 — 새 로고 에셋을 받기 전까지는 못 고침.

## 0. 이 프로젝트는 두 개의 제품으로 구성됨

원래 개인용 키워드 조회 도구로 시작했다가, 소상공인용 블로그지수(구 "대시보드", 구 "블로그 레이더")로 확장되었습니다. 서로 다른 저장소를 쓰는 **완전히 별도인 두 영역**이니 헷갈리지 말 것.

| | 개인 도구 (`/`, `/result/[sessionId]`) | 블로그지수 (`/dashboard/*`) |
|---|---|---|
| 대상 | 로그인 없이 누구나, 1회성 조사용 | 로그인 없이 누구나, 1회성 조사용 |
| 인증 | 없음 | **없음 — 2026-07 로그인/"등록업체" 개념 완전히 제거됨** (섹션 10.2 참고) |
| 저장소 | Notion 데이터베이스 | Notion 데이터베이스 (개인 도구와 동일한 세션/레코드 패턴) |
| 용도 | 임의 키워드 검색량/연관검색어 1회 조회 + CSV | 내 블로그 + 비교 블로그(최대 10개) + 키워드(최대 30개)를 즉석 입력하면 블로그 지수·키워드 노출·언급량·경쟁사노출·키워드클러스터 데이터를 조회, 결과는 공유 가능한 URL로 남음 |
| 상세 스펙 | 섹션 1~9 | 섹션 10 |

두 제품 사이의 유일한 연결점: `/`에는 블로그지수로 유도하는 CTA, `/dashboard` 헤더에는 `/`로 가는 "키워드 빠른 조회" 링크. 기능이 겹치는 화면(예전에 `/`에 있던 경쟁업체 노출순위 비교 폼)은 블로그지수 쪽 패널로 통합하고 개인 도구에서는 제거했으므로, 새 기능을 추가할 때 "이미 다른 쪽에 있는 기능은 아닌지" 먼저 확인할 것.

이 두 제품과 별개로 **어느 한쪽에도 속하지 않는 사이트 공통 기능**도 있음: `/trending`(섹션 6.3, 이메일 다이제스트는 섹션 6.4), `/guide`·`/admin`·`/contact`·`/keywords`·`/privacy`(섹션 12). `SiteHeader.tsx` 내비게이션에는 핵심 기능만 노출하고(`/keywords`·`/privacy`는 각 페이지 푸터 링크로만 접근), 새 공통 기능을 추가할 때도 여기 나열할 것.

## 1. 프로젝트 목적 (개인 도구)

- 네이버에서 검색하는 검색키워드를 이용하여 키워드의 노출 빈도 또는 검색량, 연관검색어 검색량을 한눈에 보기 쉽게 그래프 형태로 보여주는 웹사이트를 구축
- 목표: 특정 키워드를 검색하면 해당 키워드의 검색량, 비교대상 연관검색어 검색량을 표시
- 데이터 저장/입력은 **Notion 데이터베이스**를 사용하고, Notion API 연동을 통해 자동으로 데이터를 조회·집계·리포트화한다

## 2. 범위 및 제약사항

- **키워드 검색량 / 연관검색어**: 네이버 검색광고 API(공식, 무료)로 구현 가능
- **블로그 지수**: 네이버가 공식적으로 제공한 적 없는 비공식 지표이며, 2025년 12월 네이버가 API 변경으로 외부 조회 경로를 차단해 현재는 공식 수치를 가져올 수 없음 → 대신 검색 상위노출·게시글 수·댓글 수·공감 수·공유수(`src/lib/dashboard/contentDiagnostics.ts`의 `RADAR_AXES`, 2026-07 재설계 — 섹션 10.3 참고)를 자체 종합해 10점 만점으로 환산한 **자체 점수**를 "블로그 지수"로 제공함 — 네이버 공식 지표도, 제3자 블로그 지수 서비스의 산정 방식도 아님을 화면에 항상 명시할 것. 대체 지표인 **블로그 노출 순위**(특정 키워드에서 글이 몇 위에 뜨는지)는 블로그지수 쪽 경쟁사 노출 패널로 구현 완료 (섹션 10 참고)

## 3. 시스템 아키텍처

```
[사용자] → [웹사이트 프론트엔드]
                │  키워드 입력
                ▼
        [백엔드 API Route]
                │  ① 네이버 검색광고 API 호출 (키워드도구)
                │  ② 결과를 Notion DB에 저장
                ▼
          [Notion Database]  ←── Notion API로 CRUD
                │
                ▼
   [프론트엔드: 그래프 뷰 + 표] , [CSV 다운로드 링크]
```

- **프론트엔드**: 키워드 입력 → 그래프(막대 차트)로 검색량 비교 → 상세 데이터는 CSV 다운로드
- **백엔드**: 네이버 API 인증/호출 로직 (`naver_keyword_volume.py`의 서명 생성 로직 재사용)
- **데이터 저장소**: Notion 데이터베이스 (원본 데이터 보관, 이력 관리)
- **CSV 생성**: 저장된 검색 세션 데이터를 요청 시점에 CSV로 변환해 다운로드 제공 (별도 파일 저장 없이 온디맨드 생성 권장)

## 4. 데이터 흐름

1. 사용자가 웹사이트에서 키워드 입력 후 검색 실행
2. 백엔드가 네이버 키워드도구 API 호출 → 입력 키워드 + 연관 키워드 목록과 검색량 데이터 수신
3. 이번 검색을 하나의 "세션"으로 묶어 Notion `검색 세션` DB에 1건 생성
4. 응답으로 받은 키워드별 데이터를 Notion `키워드 검색 결과` DB에 각각 저장하고, 위 세션과 관계(Relation)로 연결
5. 프론트엔드는 Notion API로 해당 세션의 데이터를 조회해 그래프/표로 렌더링
6. "CSV 다운로드" 클릭 시 해당 세션의 레코드를 조회해 CSV로 변환, 다운로드 링크 제공

## 5. Notion 데이터베이스 스키마

### 5.1 검색 세션 (Search Sessions)

한 번의 키워드 검색 요청을 하나의 단위로 묶는 DB. 최근 검색 목록, CSV 다운로드의 기준이 됨.

| 속성명 | 타입 | 설명 |
|---|---|---|
| 세션명 | 제목(Title) | 예: "특성화고 - 2026-07-22" |
| 검색 키워드 | 텍스트(Text) | 사용자가 실제로 입력한 원본 키워드(들) |
| 검색일시 | 날짜(Date) | API 호출 시각 |
| 결과 개수 | 숫자(Number) 또는 Rollup | 연결된 키워드 결과 레코드 수 |
| 관련 레코드 | 관계(Relation) | 5.2 DB의 항목들과 연결 |

### 5.2 키워드 검색 결과 (Keyword Search Records)

API 응답으로 받은 키워드 1개당 1행.

| 속성명 | 타입 | 설명 |
|---|---|---|
| 키워드 | 제목(Title) | `relKeyword` |
| 구분 | 선택(Select) | `시드 키워드` / `연관 키워드` / `추론 키워드` |
| 소속 세션 | 관계(Relation) | 5.1 DB로 연결 |
| PC 월간검색수 | 숫자(Number) | `monthlyPcQcCnt` (`< 10`은 0 또는 별도 표기로 저장) |
| 모바일 월간검색수 | 숫자(Number) | `monthlyMobileQcCnt` |
| 합계 검색수 | 수식(Formula) | PC + 모바일 |
| 경쟁정도 | 선택(Select) | `낮음` / `중간` / `높음` (`compIdx`) |
| 월평균노출광고수 | 숫자(Number) | `plAvgDepth` |
| 총 블로그 발행량 | 숫자(Number) | 네이버 블로그 검색 `total` (`blogPublishStats.ts`) |
| 월간 블로그 발행량 | 숫자(Number) | 최근 30일 이내 발행 추정치 |
| 블로그 포화도 | 숫자(Number) | 월간/총 발행량 비율(%) |
| 조회일시 | 날짜(Date) | Created time으로 대체 가능 |

## 6. 웹사이트 화면 구성 (개인 도구)

### 6.1 검색 페이지 (`/`)
- 키워드 입력창 + 검색 버튼 (제출 시 `/api/search`가 SSE로 진행 상태를 스트리밍 — 섹션 10.5 참고)
- 카테고리별 인기 검색어 패널
- 검색/해결책 프로모션 섹션(`PainPointPromo`)
- 하단에 블로그지수로 유도하는 CTA
- ~~경쟁업체 블로그 노출 순위 비교 폼~~, ~~최근 검색 세션 목록~~: 각각 블로그지수 패널·`/admin` 관리자 페이지로 이동해 제거함. 재도입하지 말 것

### 6.2 결과 뷰 (`/result/[sessionId]`)
- 막대 그래프: 입력 키워드 대비 연관 키워드 검색량 비교 (PC/모바일 스택형 또는 합계 기준)
- 표: 키워드별 전체 데이터 (PC/모바일/합계/경쟁정도/월평균노출광고수/총·월간 블로그 발행량/블로그 포화도). 시드 키워드 행에는 최근 3개월 검색 트렌드 방향성 배지(▲상승/－보합/▼하락, `TrendDirectionBadge.tsx`)가 붙음 — 연관 키워드(최대 50개)까지는 비용상 안 붙임
- 네이버 데이터랩 검색어트렌드 그래프 (1개월/1년/기간 직접입력)
- "이 키워드는 누가 찾을까?" 패널(`KeywordAudiencePanel.tsx`) — 시드 키워드 첫 번째에 대해 성별/기기별 최근 3개월 추세 방향, "연령대 더보기" 클릭 시 6개 구간까지. 자세한 원리는 섹션 10.3 참고
- "CSV 다운로드" 버튼 → 해당 세션의 상세 데이터를 CSV 파일로 다운로드

### 6.3 검색량 급상승 (`/trending`)

네이버는 실시간급상승검색어(실검)를 2021년에 완전히 폐지했고 검색광고 키워드도구 API는 히스토리 없는 단일 스냅샷만 줘서, "지금 뜨는 검색어"를 네이버 자체로는 구할 방법이 없다. 두 소스를 조합해 대신함:

- **구글 트렌드 한국 일간 트렌드 RSS** (`https://trends.google.com/trending/rss?geo=KR`, 인증 불필요, `src/lib/googleTrends/client.ts`) — Google이 의도적으로 공개하는 피드라 HTML 스크래핑보다 안전함. `fast-xml-parser`로 파싱, TTL 캐시 2시간. 항목마다 기존 `fetchKeywordStats`로 실제 네이버 검색량을 best-effort 교차 조회함 — **`hintKeywords` 파라미터는 공백이 섞이면 400 에러**(실측 확인)이므로 반드시 공백 제거 후 조회할 것. 화면에는 항상 "구글 트렌드 기준 — 네이버 자체 순위 아님"을 명시(섹션 2의 자체 지표 고지 원칙과 동일).
- **자체 스냅샷 축적** — 실제 조회된 키워드의 네이버 검색량을 Notion `키워드 검색량 스냅샷` DB(스키마는 `src/lib/notion/schema.ts`의 `SNAPSHOT_PROPS`)에 날짜별로 쌓아 증가율을 계산(`src/lib/notion/keywordSnapshots.ts`의 `getRisingKeywords`, 최소 20일 이상 간격만 인정). 두 경로로 채워짐: (1) `/api/search`가 검색할 때마다 편승해서 저장(추가 네이버 API 호출 없음), (2) `src/lib/scheduler/snapshotJob.ts`가 카테고리 시드 키워드+현재 구글 트렌드 목록을 12시간마다 훑는 정기 잡. 데이터가 부족하면(신규 배포 직후 등) 정직한 빈 상태 문구를 보여줌 — 없는 상승률을 지어내지 말 것. `getRisingKeywords`는 스냅샷 DB 전체를 필터 없이 훑는 무거운 계산이라(스냅샷이 쌓일수록 느려짐) 1시간 TTL 캐시를 씌워둠(2026-07 추가) — 실측으로 첫 방문 5.5초 → 캐시 적중 시 0.3초로 확인.
- **`/trending`에 `loading.tsx` 있음**(2026-07 추가, `/dashboard/[sessionId]`와 같은 이유) — 홈페이지의 "요즘 뜨는 검색어 더보기" 링크로 들어올 때 구글 트렌드/자체 스냅샷 라이브 조회가 끝날 때까지 화면이 멈춘 것처럼 보이는 문제가 있었음. `/trending`은 전용 `layout.tsx`가 없어서(`/dashboard/*`와 다름) 이 `loading.tsx`가 `SiteHeader`를 직접 렌더링함 — 안 그러면 로딩 중 헤더가 깜빡이며 사라짐.
- **`src/instrumentation.ts`**가 이 정기 잡을 서버 시작 시 1회 등록하는 **이 프로젝트 최초의 상시 백그라운드 잡**(요청과 무관하게 항상 돎) — 섹션 11의 상주형 서버 전제와 직결됨.

### 6.4 급상승 키워드 이메일 다이제스트

`/trending` 하단 `NewsletterSubscribeForm.tsx`(`components/trending/`)에서 이메일을 입력하면 매주 급상승 키워드 요약을 받아볼 수 있음(2026-07 추가) — 1회성 조회 도구인 나머지 사이트와 달리 **재방문을 유도하는 유일한 기능**.

- **구독**: `POST /api/subscribe` → `src/lib/notion/subscribers.ts`의 `subscribeEmail()`이 Notion `뉴스레터 구독자` DB(`NOTION_SUBSCRIBERS_DB_ID`, `scripts/setup-notion-subscribers.ts`로 생성)에 저장. 이메일(제목 속성) 중복 신청은 기존 행을 재사용하고 새로 안 만듦.
- **구독 해지**: 구독 시점에 발급하는 임의 토큰(`구독해지토큰` 속성)을 이메일 자체 대신 식별자로 씀 — 이메일 주소로 바로 해지시키면 남의 이메일도 임의로 해지할 수 있어서다. `GET /api/unsubscribe?token=...`이 토큰으로 행을 찾아 `archived: true`로 소프트 삭제. 모든 발송 메일에 이 링크가 반드시 포함되어야 함(법적 요건이자 섹션 12.4 개인정보처리방침과 일치시켜야 하는 부분).
- **발송 잡**: `src/lib/scheduler/newsletterJob.ts`가 구독자 전원에게 그 시점의 급상승 키워드(구글 트렌드)+상승 키워드(자체 스냅샷)를 Resend로 발송. `src/instrumentation.ts`에 스냅샷 잡과 같은 `setInterval` 패턴으로 등록하되, **스냅샷 잡과 달리 서버 시작 시 즉시 실행하지 않음**(매 배포마다 구독자에게 메일이 나가면 안 되므로). 이 방식의 알려진 트레이드오프: 별도의 "마지막 발송일" 저장소가 없어서, 서버가 발송 주기(`NEWSLETTER_JOB_INTERVAL_MS`, 7일)보다 자주 재배포되면 그 사이 발송이 아예 안 나갈 수 있음 — 배포 주기가 잦아지면 발송 이력을 Notion 등에 남겨 확인하는 방식으로 바꿔야 함.

## 7. 기술 스택

- **프론트엔드/백엔드**: Next.js App Router (API Route에서 네이버 API 호출 및 Notion API 연동 처리)
- **그래프**: recharts
- **형태소 분석**: garu-ko (WASM 기반, 명사 빈도 추출 — 제목 키워드 백필/자주 쓰는 단어 분석에 사용)
- **데이터 저장**: Notion API (`@notionhq/client`)
- **XML 파싱**: fast-xml-parser (구글 트렌드 RSS 섹션 6.3, 블로그 게시물 RSS 섹션 10.3)
- **HTML 파싱**: cheerio (2026-07 추가, 블로그 게시물 본문 구조 통계 — 글자수/이미지/인용구/링크수, 섹션 10.3)
- **이미지 내보내기**: html-to-image (블로그지수 결과 PNG 저장, 섹션 10.3)
- **이메일**: Resend (문의하기, 섹션 12.3)
- **배포**: 상주형 서버(VPS/Railway/Render/Fly.io) — 섹션 11 참고. Vercel 같은 서버리스는 이 앱의 인메모리 공유 상태(오픈API 스로틀, 스크래핑 캐시)와 맞지 않아 부적합

## 8. UI/UX
- design-system.md

## 9. 참고

- 네이버 검색광고 API 인증(HMAC-SHA256 서명) 및 호출 로직은 기존 `naver_keyword_volume.py`를 참고해 그대로 이식
- Notion API 사용을 위해서는 Notion에서 Integration을 생성하고, 대상 데이터베이스에 해당 Integration을 연결(공유)해야 함

## 10. 블로그지수 (`/dashboard/*`, 구 "대시보드"/"블로그 레이더")

로그인 없이 누구나 내 블로그 주소 + 비교 블로그(최대 10개, 선택) + 키워드(최대 30개, 선택)를 입력하면 즉석에서 블로그 지수·키워드 노출·언급량·경쟁사노출·키워드클러스터를 보여주는 1회성 조회 도구. URL(`/dashboard/*`)과 내부 코드 경로(`src/app/dashboard/`, `src/lib/dashboard/`)는 예전 이름 그대로 유지 — 화면에 보이는 명칭만 "블로그지수"로 바뀐 것.

**2026-07 대규모 재설계로 "등록업체"/Supabase 개념이 완전히 삭제됨.** 예전에는 로그인한 소상공인이 업체(이름/카테고리/키워드/경쟁업체)를 등록해 지속 추적하는 구조였으나, 지금은 개인 도구와 동일하게 매번 새로 입력해 즉석 조회하고 결과 URL로 다시 찾아보는 구조다. 로그인 기능이 생기기 전까지는 저장된 "내 업체 목록" 같은 개념 자체가 없다 — 다시 도입하려면 사용자에게 먼저 확인할 것.

### 10.1 데이터 저장소 (Notion, 개인 도구와 동일 패턴)

- `블로그지수 세션`(내 블로그 도메인/비교 블로그 목록/키워드 목록/부족 항목/업체명(선택, 2026-07 추가)/비교 업체명 목록(선택, 2026-07 추가 — 업체명·비교 업체명 둘 다 지역·플레이스 진단용, 섹션 10.3 참고)) + `블로그지수 결과`(도메인별 1행: 종합점수 + `RADAR_AXES` 5개 지표 축 + 블로그 프로필 스탯 + 최근 게시물 평균 댓글·공감·공유수 + 자주 쓰는 단어) 두 DB. 세션-레코드 관계 구조는 개인 도구의 검색세션/키워드검색결과와 동일한 방식. 2026-07 점수 모델 전면 재설계 당시 이제 안 쓰는 `keywordCoverage`/`highVolumeCoverage`/`lowCompetitionCoverage`/`freshness` Notion 컬럼은 additive-only 원칙에 따라 삭제하지 않고 그대로 남겨둠(레거시, 죽은 컬럼) — `postVolume` 컬럼은 이름은 그대로지만 의미가 "키워드 매칭 개수"에서 "게시글 수 축 점수"로 바뀌었음.
- **"메인 (블로그지수)" 탭**은 세션 생성 시점에 계산해 Notion에 저장 → 재방문해도 그대로 보여줌.
- **"키워드 노출·빈도" 탭**(키워드검색량/언급량/경쟁사노출/키워드클러스터/데이터랩)은 저장하지 않고 방문할 때마다 라이브 재조회함 — 알려진 트레이드오프(재방문 시 느릴 수 있음). 키워드 20개+비교 블로그 여러 곳처럼 규모가 크면 네이버 오픈API 공유 스로틀(초당 1회) 때문에 전체 재조회가 1분 이상 걸릴 수 있어서 `dashboard/[sessionId]/page.tsx`가 두 가지로 완화함: (1) 이 탭의 패널 4개(키워드검색량/언급량/경쟁사노출/키워드클러스터) 각각을 별도 async 컴포넌트로 쪼개 `<Suspense>`로 감싸서, "메인" 탭(Notion 읽기 2번뿐이라 원래 빠름)이 이 탭의 가장 느린 패널에 발목 잡히지 않고 즉시 스트리밍되게 함. (2) `openApiClient.ts`의 `searchBlog`/`searchCafe`를 React `cache()`로 요청 단위 메모이제이션해서, 언급량·경쟁사노출·키워드클러스터 패널이 겹치는 키워드에 대해 똑같은 기본 정렬(sim) 검색을 각자 다시 던지지 않게 함(예전엔 키워드당 최대 3번 중복 호출됨). 새 패널을 이 탭에 추가할 때도 이 두 패턴(Suspense 분리 + 겹치는 검색어는 cache()로 재사용)을 유지할 것 — 하나라도 빠지면 규모가 큰 세션에서 다시 느려짐.

### 10.2 인증 — 없음, 완전 개방 (2026-07 Supabase/OAuth 전체 삭제됨)

- 원래 네이버 소셜 로그인 + Supabase Auth + 업체 등록 구조였으나, 로그인·업체 등록·Supabase 자체를 전부 삭제하고 Notion 기반 즉석 조회로 재설계했다. `@supabase/*` 패키지, `supabase/migrations/`, `src/lib/supabase/`, `src/lib/auth/`, 관련 API 라우트/컴포넌트 전부 삭제됨 — 되살리지 말 것, 필요해지면 완전히 새로 설계할 것.
- 소유권 개념이 없다는 원칙은 유지: 결과 URL을 아는 사람은 누구나 볼 수 있음 (개인 도구의 `/result/[sessionId]`와 동일한 수준의 공개성).

### 10.3 패널

| 패널 | 데이터 소스 | 비고 |
|---|---|---|
| 블로그 지수 (메인 탭) | 아래 5개 지표 종합 | 10점 만점, `RADAR_AXES` 지표 평균 (`src/lib/dashboard/contentDiagnostics.ts`) |
| 게시글별 분석 (메인 탭) | RSS + 게시물 페이지 스크래핑 | 최근 게시물별 글자수/이미지/인용구/내부·외부링크/댓글/공감/공유 표, 아래 참고 |
| 지역·플레이스 진단 (메인 탭) | 네이버 오픈API 지역검색(`local.json`) + `findLocalExposureRank`(`src/lib/dashboard/exposure.ts`) | 업체명 입력 시에만 노출, 아래 참고 |
| 키워드 검색량 | 네이버 검색광고 API | + 총·월간 블로그 발행량/포화도 (`src/lib/naver/blogPublishStats.ts`, 키워드당 3시간 TTL 캐시 — 같은 키워드가 여러 검색에 겹칠 때 네이버를 재호출하지 않도록) |
| 블로그·카페 언급량 | 네이버 오픈API 검색 | |
| 블로그 노출 순위 | 네이버 오픈API 블로그검색 + `findExposureRank`(`src/lib/dashboard/exposure.ts`) | 내 블로그 + 비교 블로그를 함께 순위 비교(아래 참고) |
| 키워드 클러스터 & 콘텐츠 전략 | 네이버 검색광고 API (마인드맵) | 규칙 기반 제목/태그 추천 (AI 아님). 연관 키워드가 3개 이하면 시드+수식어 조합으로 추가 조회해 보강 |
| 키워드 검색량 트렌드 배지 | 네이버 데이터랩 검색어트렌드 | 키워드 검색량 패널의 상위 `MAX_TREND_BADGE_KEYWORDS`(10)개까지, 개인 도구와 동일한 `TrendDirectionBadge` 재사용 |

**블로그 지수 5개 지표(`src/lib/dashboard/contentDiagnostics.ts`의 `RADAR_AXES`, 2026-07 전면 재설계)**: 검색 상위노출(스캔한 키워드 평균 노출순위) / 게시글 수(블로그 프로필의 실제 총 포스팅 수, 전체 기간) / 댓글 수 / 공감 수 / 공유수(뒤 셋은 `fetchPostAnalysis()`가 가져온 최근 게시물 최대 `RECENT_POST_SAMPLE`(50)개의 평균, `src/lib/naver/blogEngagementScraper.ts`) — **주의: "최근 3개월" 같은 달력 기준 기간이 아니라 "최근 게시물 개수" 기준 표본**이다. 매일 쓰는 블로그는 이 50개가 며칠치일 뿐이고, 가끔 쓰는 블로그는 몇 달~1년치가 섞일 수 있음 — 블로그마다 실제로 커버하는 기간이 다르다는 걸 화면 문구·해석에서 혼동하지 말 것. 배열 하나로 관리되므로 축을 추가/삭제할 때 이 배열만 건드리면 컴포짓 점수·갭 메시지·화면 그리드가 자동으로 따라감. 예전엔 키워드 커버리지/고검색량 공략도/저경쟁 공략도/콘텐츠 최신성 중심이었으나, 사용자 요청으로 검색 상위노출·게시글 수·댓글 수·공감 수·공유수로 완전히 바뀜(조회수·개설일·방문자 히스토리는 실측 재조사에도 여전히 공개 경로를 못 찾아 축에서 제외 — 아래 참고). 데이터랩 쇼핑인사이트 승인 후 붙일 자리가 없어진 옛 "데이터랩 트렌드" 플레이스홀더(`DatalabTrendPanel.tsx`)는 삭제함 — 쇼핑인사이트는 홈페이지 카테고리 패널 쪽으로 옮겨감(아래).

**2026-07 절대기준 재설계(사용자 요청 — "논리적 오류 없는지 점검")**: 재점검 결과 두 가지 실제 결함이 있었음.
1. 검색 상위노출 축이 **매칭된 키워드만** 평균 내고 있어서, 8개 중 1개만 1위이고 나머지 7개는 아예 안 뜨는 블로그도 `avgRank=1`이 되어 만점을 받는 버그가 있었음 — 놓친 키워드에 페널티가 없었던 것. `computeExposureScores()`를 스캔한 키워드 전체를 분모로 쓰고 안 뜬 키워드는 `WORST_RANK`(101)로 계산에 포함하도록 고침.
2. 게시글수·댓글수·공감수·공유수 4개 축(점수의 80%)이 **"이번 조회에 함께 넣은 대상 중 최댓값" 기준 상대점수**였음 — 비교 블로그를 안 넣으면(선택 입력이라 흔함) 분모가 자기 자신이 되어 값이 있으면 무조건 100점, 없으면 0점으로 이진화되는 버그였고, 화면은 10점 게이지·"일반/준최적화/최적화" 밴드·외부 배지(`/api/badge`)로 절대 지표처럼 보여주면서 실제로는 그때그때 비교 대상에 따라 같은 블로그도 점수가 요동치는 구조적 모순이 있었음. `applyPostCountScores`/`applyPostAnalysisScores`를 고정 절대 임계값 기준으로 바꿔서, 이제 비교 대상을 뭘 넣든(0곳이든 10곳이든) 같은 블로그는 같은 점수가 나옴 — 실측으로 확인(비교 블로그 없이 `ravelish` 단독 조회 시 이전 로직이면 댓글·공감·공유 3개 축이 전부 100점이 되어 컴포짓 스코어 ~99.8이 나왔을 것을, 수정 후 실제로는 40점으로 나옴 — 댓글 0개·공유 0개인 실제 상태를 정직하게 반영).
   - 게시글 수는 오더가 크게 벌어질 수 있어(`POST_COUNT_LOG_CAP`=1000 기준 로그 스케일) 대형 블로그 하나가 나머지를 극단적으로 눌러버리는 문제를 피함.
   - 댓글·공감·공유수는 값 범위가 좁아 선형 스케일(`MAX_AVG_COMMENTS`=5 / `MAX_AVG_REACTIONS`=20 / `MAX_AVG_SHARES`=3 — 네이버 블로그는 댓글·공유보다 공감이 훨씬 흔해서 캡이 다름).
   - **이 임계값들은 실측 표본 몇 곳을 참고한 초기 추정치** — 추후 실사용 데이터가 쌓이면 재조정이 필요할 수 있음. 감으로 조이거나 풀지 말고, 실측 분포를 다시 확인한 뒤 바꿀 것.
3. **키워드 의존성**: 5개 축 중 검색 상위노출 1개(가중치 20%)만 입력한 키워드에 따라 달라지고, 나머지 4개(80%)는 키워드와 무관함(블로그 프로필 총 포스팅 수·최근 게시물 평균이라 어떤 키워드를 넣든 안 넣든 값이 같음) — 키워드를 하나도 안 넣으면(선택 입력) 검색 상위노출 축은 자동 0점 처리되어 나머지 4개 축 평균에서 20%p를 손해 보고 시작함. "블로그 지수"라는 이름과 달리 키워드 관련성보다는 최근 콘텐츠 활동량·반응을 주로 재는 지표에 가까움 — 화면 문구를 새로 쓸 때 이 점을 오해하지 않도록 유의할 것.

**블로그·지역·플레이스 노출 순위** (2026-07 확장, 사용자 요청 — "지역, 네이버 통합검색, 플레이스, 블로그에 대한 노출 순위도 조회 가능하도록"): 세 가지 검색 영역을 조사한 결과 서로 성격이 달라 사용자와 논의 후 범위를 나눔.
- **블로그**: 기존 "경쟁업체 블로그 노출 순위" 패널이 비교 블로그만 순위를 보여주고 정작 "내 블로그"는 빠져있던 실사용 갭을 같이 고쳐서, `CompetitorExposurePanel.tsx`가 이제 내 블로그(`isMine` 배지)까지 포함한 전체 순위표를 보여줌(패널명도 "블로그 노출 순위"로 변경). `dashboard/[sessionId]/page.tsx`가 `session.myBlogDomain` + `competitorDomains`를 하나의 `ExposureDomainEntry[]`로 합쳐 넘김.
- **지역·플레이스**: 네이버 오픈API 지역검색(`local.json`)으로 공식 조회 가능 — `searchLocal()`(`openApiClient.ts`)은 이미 있었지만(재설계 전 로컬노출 패널이 쓰던 것) 어디서도 안 쓰이고 있었음. 이 API는 결과가 블로그 URL이 아니라 업체명(상호명)이라 도메인 기반 매칭(`findExposureRank`)을 그대로 못 쓰고, 새 `findLocalExposureRank()`가 `<b>` 하이라이트 태그를 벗겨낸 뒤 업체명 양방향 부분일치로 순위를 찾음(지점명이 붙는 경우 대응). 도메인이 아니라 업체명이 매칭 기준이라 세션 입력 폼에 **"업체명"(선택) 필드를 다시 추가**함(`BLOG_SCORE_SESSION_PROPS.businessName`, `scripts/add-blog-score-business-name-prop.ts`로 마이그레이션). 지역검색 API는 **`display` 최대 5**로 하드캡되어 있어(`MAX_LOCAL_DISPLAY`, blog/cafe의 100과 다름) 6위 밖은 실제 순위와 무관하게 항상 "미노출"로 보임 — `LocalExposurePanel.tsx`에 이 제약을 안내 문구로 명시함.
  - **2026-07 "지역·플레이스 진단" 카드로 확장·이동**(사용자 요청 — "플레이스, 지역 입력시 해당 진단 결과도 노출해줬으면"): 처음엔 "내 업체" 단일 값만 받아 "키워드 노출·빈도" 탭의 별도 패널로 있었는데, ① "비교 업체명"(선택, `BLOG_SCORE_SESSION_PROPS.competitorBusinessNames`, `scripts/add-blog-score-competitor-business-names-prop.ts`) 필드를 폼에 추가해 경쟁 업체 상호명과도 비교할 수 있게 했고(`getDashboardLocalExposure`가 이제 `LocalExposureEntry[]`를 받아 블로그 노출 패널과 같은 다중 컬럼 표 구조), ② 패널을 "키워드 노출·빈도" 탭에서 **"메인 (블로그지수)" 탭**으로 옮겨 "지역·플레이스 진단" 카드로 만듦(`PostAnalysisSection` 아래, 같은 이유로 자체 `<Suspense>`). **중요: 블로그 지수 컴포짓 점수(`RADAR_AXES`)에는 포함시키지 않기로 사용자와 명시적으로 합의함** — 별도 진단 카드로만 노출. 이유를 물었을 때 "점수엔 포함 안 하고 메인 탭에 진단 카드만 추가"를 선택한 것 — 6번째 축으로 넣고 싶어지면 반드시 사용자에게 먼저 확인할 것(RADAR_AXES에 넣으면 업체명 없는 세션의 컴포짓 점수 계산 방식도 같이 정해야 하는 등 파급 범위가 큼). `LocalExposurePanel.tsx`가 "내 업체" 기준 진단 요약 문장(상위 5위 안 노출 개수)도 함께 보여줌.
- **네이버 통합검색(블렌디드 SERP)**: 공식 API가 없어서 이걸 하려면 실제 검색결과 페이지(`search.naver.com`)를 직접 스크래핑해야 하는데, §10.4에서 승인된 예외(블로그 프로필/게시물 페이지)보다 훨씬 민감한 대상이라(네이버 핵심 검색결과라 봇 차단·캡차 가능성이 훨씬 높고 약관 리스크도 큼) **사용자와 논의 후 이번 범위에서 명시적으로 제외함**. 다시 검토하려면 §10.4 원칙대로 먼저 트레이드오프를 논의하고 승인받을 것 — 추측으로 조용히 구현하지 말 것.

**게시글별 분석** (2026-07 추가, "메인" 탭 `PostAnalysisPanel.tsx`, `dashboard/[sessionId]/page.tsx`의 `PostAnalysisSection`): 제3자 블로그 분석 도구의 게시글 표를 참고해 만든 패널 — 도메인(내 블로그 + 비교 블로그)별로 최근 게시물(`RECENT_POST_SAMPLE`, RSS 피드가 주는 최대치인 50개 — 2026-07에 8→50으로 상향, 아래 참고) 각각의 제목/발행일/글자수/이미지수/인용구수/내부·외부링크수/댓글/공감/공유를 표로 보여줌. "메인" 탭의 나머지(블로그 지수 점수)와 달리 **세션 생성 시점에 Notion에 저장하지 않고 방문할 때마다 라이브 조회**함(§10.1의 "메인 탭=저장 / 키워드 탭=라이브" 이분법의 예외 — 게시글 최대 50개 × 여러 도메인의 상세 데이터를 Notion rich_text 2000자 제한 안에 안전하게 넣기 어려워서, 대신 `fetchPostAnalysis()`의 6시간 TTL 캐시를 세션 생성 시 점수 계산과 이 표가 공유하므로 세션 생성 직후 방문은 대부분 캐시 히트로 빠름). `page.tsx`에서 자체 `<Suspense>` 경계로 감싸 나머지 "메인" 탭(Notion 읽기 2번뿐이라 빠름)을 막지 않게 함 — §10.1의 "키워드 노출·빈도" 탭과 같은 이유. **2026-07 종단간 실측 검증 완료**: 네이버 블로그 검색으로 찾은 실제 운영 중인 블로그(예: `blog.naver.com/ravelish`)를 내 블로그로, 다른 실제 블로그를 비교 블로그로 넣어 `/api/blog-score`를 실제로 호출 → Notion에 저장 → `/dashboard/[sessionId]` 결과 페이지 렌더링까지 전 구간 확인. 라이킷 API로 조회한 공감수가 게시물마다 실제로 다른 값(1~3)으로 나오는 것, 댓글·공유수·글자수·이미지수 등 게시글별 분석 표가 실제 데이터로 채워지는 것까지 확인됨 — 더미/스텁이 아니라 진짜 스크래핑 파이프라인이 동작함.

**"공감"(라이킷)·"공유수" 재조사 (2026-07)** — 예전엔 로그아웃 상태에서 접근 가능한 정적 페이지에 `isReactionEnable`(기능 켜짐 여부 플래그)만 있고 실제 숫자가 없어서 "얻을 수 없음"으로 결론 내렸었음(섹션 10.4 옛 버전). 사용자가 실제 스크래핑으로 다시 확인해달라고 요청해 재조사한 결과, 이 결론이 **틀렸던 것으로 확인됨**: 네이버 프론트엔드가 공감수를 클라이언트에서 별도의 공개 JSON API(`https://blog.like.naver.com/v1/search/contents?q=BLOG[{blogId}_{logNo}]`, 인증 불필요, 게시글 URL과 일치하는 `Referer`만 필요)로 호출하고 있었음 — 문서화되지 않은 엔드포인트라 실측(`q` 파라미터명, 응답 구조)으로 확인함. 공유수(`shareCount`)는 더 간단하게, 게시글 페이지 자체의 escape된 JSON 블롭 안에 이미 있음(기존 `commentCount` 추출과 같은 패턴). **앞으로 "공감/공유는 얻을 수 없다"고 재결론 내리기 전에 반드시 이 라이킷 엔드포인트를 먼저 재확인할 것** — `src/lib/naver/blogEngagementScraper.ts` 상단 주석에도 같은 경고가 있음. 게시글 본문 구조 통계(글자수/이미지수/인용구수/내부·외부링크수)는 네이버 SmartEditor가 서버사이드로 렌더링하는 안정적인 클래스명(`.se-main-container`/`.se-text`/`.se-quote`/`.se-module-image`)을 `cheerio`(신규 의존성, 2026-07 추가)로 파싱해서 얻음 — 기존처럼 정규식을 계속 쌓는 대신 실제 DOM 파서를 쓴 것. 조회수·개설일·일별 방문자 히스토리는 이번 재조사에서도(`urlMap`/`blogHomeInfo`/`blogUserInfo`/`blogIntroduce`/`blogReputation` 전수 확인) 공개 경로를 찾지 못함 — 여전히 §10.4 원칙대로 구현하지 않음.

**임베드 배지** (2026-07 추가, "메인" 탭 하단 `EmbedBadgeCard.tsx`): 소상공인이 자기 블로그에 붙일 수 있는 `<img>` 배지 코드를 제공 — 배지를 클릭하면 이 세션의 `/dashboard/[sessionId]`로 연결되는 백링크이자 재유입 경로. 배지 이미지 자체는 `GET /api/badge/[sessionId]`가 `next/og`의 `ImageResponse`로 즉석 렌더링(320×88, 종합점수만 표시). 이 라우트는 **다른 사람 블로그에 계속 박제되어 매 방문자마다 호출**되므로, `getBlogScoreSessionById`/`getRecordsForBlogScoreSession` 조회 결과를 세션당 24시간 TTL 캐시(`createTtlCache`)에 담아 재요청마다 Notion을 다시 때리지 않게 함 — 어차피 점수는 세션 생성 시점에 고정되고 다시 안 바뀌므로(섹션 10.1) 긴 TTL이 안전함.

### 10.3.1 데이터랩 확장 (검색어트렌드 방향성 + 연령·성별·기기 + 쇼핑인사이트)

**2026-07, 데이터랩 쇼핑인사이트 승인 완료**(`npm run test:datalab`으로 실측 확인) — 더 이상 "승인 대기 중"이 아님. 검색어트렌드(`/v1/datalab/search`)는 원래부터 별도 승인 없이 쓸 수 있었음.

- **트렌드 방향성 배지** (`src/lib/naver/trendDirection.ts`의 `computeTrendDirection`, `src/components/TrendDirectionBadge.tsx`) — 최근 3개월 구간을 전반부/후반부로 나눠 평균 비율을 비교(±10% 미만은 "보합"). 개인 도구(`/result`, 시드 키워드만)와 블로그지수(`KeywordVolumePanel`, 상위 10개까지) 양쪽에서 재사용. 백엔드는 `POST /api/trend-badge`(키워드 목록만 받음, 세션 타입에 안 묶임).
- **"이 키워드는 누가 찾을까?" 연령·성별·기기 패널** (`src/components/search/KeywordAudiencePanel.tsx`, `POST /api/keyword-audience`) — **중요**: 검색어트렌드 API는 `device`/`gender`/`ages` 필터를 걸어도 그 결과가 다시 자기 구간 안에서 0~100으로 재정규화됨(실측 확인 — 필터를 걸어도 최고점이 그대로 100으로 나옴). 그래서 "여성이 남성보다 검색을 더 많이 한다" 같은 **크기 비교는 데이터상 근거가 없음** — 이 사실 자체는 변하지 않으니 새 기능을 추가할 때도 항상 감안할 것. 연령대는 원본 코드가 1~11(0~12세부터 60세~까지 세분화)이라 너무 잘게 쪼개져 있어서, 코드 2개씩 묶어 자연스러운 "10대/20대/.../60대 이상" 6구간으로 재구성함(`src/lib/naver/audienceGroups.ts`) — 코드를 배열로 여러 개 넘기면 그 구간들의 합집합 결과 하나가 옴(실측 확인, 구간별로 쪼개서 안 옴).
  - **2026-07 그룹 비교 꺾은선 그래프 추가** — 사용자가 "남성이 여성보다 많은지 비교할 수 있게 타임라인 그래프를 넣어달라"고 요청. 위 재정규화 특성상 그룹을 같은 축에 겹쳐 그리면 실제로는 근거 없는 크기 비교를 시각적으로 더 설득력 있게(그리고 더 잘못) 전달할 위험이 있다고 먼저 설명했고, 사용자가 이 트레이드오프를 인지한 상태에서 **그룹 간 겹친 그래프로 진행하기로 명시적으로 선택함** — 그러니 이 그래프가 "크기 비교 UI 금지" 원칙에 위배되는 게 아니라, 사용자가 위험을 감수하고 승인한 의도된 예외임. `AudienceLineChart`(`KeywordAudiencePanel.tsx` 내부)가 성별/기기/연령대 각각에 대해 그룹들을 하나의 `LineChart`에 겹쳐 그림(`SearchTrendPanel.tsx`의 `mergeResults`와 같은 패턴). `/api/keyword-audience`가 이제 `direction`뿐 아니라 원본 기간별 `data`(`TrendDataPoint[]`)도 그대로 반환함 — 화면 상단 안내 문구("그룹별로 각자 안에서 다시 정규화된 지수라 그룹 간 크기 비교는 어려워요")는 사용자 요청대로 그대로 유지함. 이 예외를 다른 곳(예: 블로그지수)으로 조용히 확장하지 말 것 — 이번 결정은 이 패널 한정.
- **홈페이지 카테고리 패널의 쇼핑 관심도** (`src/lib/naver/datalabCategories.ts`의 `CATEGORY_CID_MAP`, `src/lib/naver/categoryShoppingTrend.ts`) — 쇼핑인사이트는 모든 호출에 카테고리 ID(CID)가 필수인데 네이버가 임의 키워드→카테고리 매칭 API를 안 줘서, 홈페이지 기존 8개 카테고리(`categoryTrends.ts`) 중 **실측으로 CID를 검증한 패션/뷰티/헬스·운동/여행 4개에만** 적용함. 외식·맛집/카페·디저트/교육은 애초에 소매 상품 카테고리가 아니라 대응 CID가 없고, 반려동물은 후보 CID들을 실측 시도했으나 데이터가 안 나와 확정 못함 — **새 카테고리를 이 맵에 추가하려면 반드시 실제 API 응답으로 CID를 먼저 검증할 것, 추측 금지**. 매핑 없는 카테고리는 그 섹션 자체를 조용히 숨김(빈 상태 문구도 안 씀).
- **공유 스로틀** — `datalabSearchClient.ts`·`datalabClient.ts`가 기존엔 `openApiClient.ts`의 스로틀을 안 거치고 각자 fetch했는데, 셋 다 같은 `NAVER_OPENAPI_CLIENT_ID/SECRET`을 쓰는 만큼 네이버 쪽 쿼터가 같은 버킷일 가능성이 있어 `src/lib/naver/throttle.ts`(신규)로 통합함. 새 데이터랩/오픈API 호출을 추가할 때 이 공유 스로틀을 거칠 것.

- **결과 이미지 저장**: "메인 (블로그지수)" 탭에 "이미지로 저장" 버튼(`src/components/dashboard/ExportableImage.tsx`) — `html-to-image`로 PNG 다운로드. `html2canvas`가 아니라 이걸 쓴 이유는 CSS를 직접 재구현하는 대신 실제 브라우저 렌더링을 그대로 캡처해서 이 프로젝트의 Tailwind v4 스타일(oklch 등)에 더 안전하기 때문. 카카오톡 공유 용도.
- 조회수/방문자수는 네이버 검색 API에 필드 자체가 없고, 블로그 통계(체류시간 등)는 소유자 로그인 전용 비공개 데이터라 API로도 스크래핑으로도 가져올 수 없음 — **요청받아도 만들어내지 말 것** (섹션 10.4 참고)
- `src/lib/naver/throttle.ts`의 `throttle()`이 오픈API 검색(`openApiClient.ts`)과 데이터랩 검색어트렌드·쇼핑인사이트(`datalabSearchClient.ts`/`datalabClient.ts`) 호출 전부를 공유 스로틀(최소 1초 간격)로 감쌈 — 새 오픈API/데이터랩 호출을 추가할 때 이 헬퍼를 거치지 않으면 429 레이트리밋에 바로 걸림. 이 스로틀은 인메모리 변수라 **상주형 서버 전제** (섹션 11 참고)
- 패널 하나가 실패해도 나머지가 죽지 않도록 `src/app/dashboard/[sessionId]/page.tsx`의 `settle()` 헬퍼로 각 패널을 개별 격리해서 fetch

### 10.4 비공식 스크래핑 (사용자 승인된 예외)

네이버 공식 API가 없는 데이터를 다룰 때 이 프로젝트의 기본 원칙은 "공식 API만 사용"이지만, 아래 두 가지는 사용자와 트레이드오프를 논의한 뒤 명시적으로 승인받은 예외임 — 다른 데이터에 함부로 이 예외를 확장하지 말 것.

- `src/lib/naver/blogProfileScraper.ts`: m.blog.naver.com의 `window.__INITIAL_STATE__`에서 카테고리/이웃수/방문자수/포스팅수 추출.
- `src/lib/naver/blogEngagementScraper.ts`: rss.blog.naver.com에서 최근 게시물(`fetchPostAnalysis`는 `RECENT_POST_SAMPLE`=50개, `fetchPostTags`는 호출자가 개별 지정) 링크를 얻고, 각 게시물 페이지에 escape되어 박혀 있는 `commentCount`/`shareCount`를 정규식으로 추출, `.blog.like.naver.com`의 비공식 라이킷 API로 공감수를 조회, `cheerio`로 본문 구조 통계(글자수/이미지/인용구/링크수)를 파싱함 — 상세 내용과 "공감/공유는 얻을 수 없다"고 재결론 내리기 전에 확인할 것은 섹션 10.3의 "공감·공유수 재조사" 문단 참고. 태그(`fetchPostTags`)도 같은 파일에서 게시물 페이지 본문에 박혀 있는 `tagNames` 필드를 정규식으로 추출.
- 방문자 체류시간·제3자 서비스의 "블로거랭킹"은 네이버 소유자 로그인 전용 비공개 데이터이거나 제3자가 자체 계산한 값이라 어떤 방식(크롤링 포함)으로도 얻을 수 없음 — 규칙을 우회해도 존재하지 않는 데이터라 지어낼 수밖에 없음. 요청받아도 구현하지 말 것.
- 둘 다 도메인 기준 **6시간 TTL 인메모리 캐시**(`src/lib/utils/ttlCache.ts`)를 적용 — 동일 도메인 반복 조회 시 네이버로 나가는 실제 요청을 줄여 지연시간과 IP 차단 리스크를 함께 낮춤. 실패(null)는 캐싱하지 않음(일시적 오류가 TTL 내내 "비공개"로 얼어붙지 않도록). **이 캐시는 인메모리라 상주형 서버 전제** — 서버리스로 옮기면 Redis 등 외부 저장소로 바꿔야 함 (섹션 11 참고).

### 10.5 검색 진행 표시 (SSE)

- `/api/search`, `/api/blog-score`는 일반 JSON이 아니라 `text/event-stream`으로 진행 상태를 스트리밍함 (`src/lib/utils/sse.ts` + 클라이언트 `readSseStream.ts`). 네이버 오픈API 공유 스로틀(초당 1회) 때문에 키워드/경쟁사가 많으면 검색이 수십 초씩 걸릴 수 있어서, "○○ 확인 중..." 같은 실시간 상태로 "버튼이 안 눌린다"는 오해를 막기 위함. 새로 느린 검색 폼을 만들 때도 이 패턴을 따를 것.

### 10.6 스타일

- `design-system.md` 기준 ezzsearch 브랜드(coral/amber, Pretendard, 라이트 모드 전용 — 다크모드 없음)를 `/`, `/dashboard` 양쪽에 동일 적용. 새 UI를 추가할 때 토큰을 새로 발명하지 말고 기존 `--chart-*`/브랜드 CSS 변수를 재사용할 것

## 11. 배포

- **서버리스 부적합, 상주형 서버로 결정함 (2026-07, 사용자와 논의)** — 이 앱은 네이버 오픈API 공유 스로틀(`openApiClient.ts`)과 스크래핑 결과 캐시(`ttlCache.ts`)를 인메모리 변수로 구현해서, Node 프로세스가 하나 계속 떠 있어야 "전체 방문자가 공유"라는 설계 의도가 실제로 성립한다. Vercel처럼 요청마다 다른 인스턴스가 뜰 수 있는 서버리스 환경에서는 이 공유가 깨지고, `/api/search`·`/api/blog-score`의 SSE 스트리밍도 서버리스 함수 실행시간 제한에 걸려 중간에 끊길 수 있다. VPS/Railway/Render/Fly.io 등 Node 프로세스가 계속 떠 있는 플랫폼을 쓸 것. **`src/instrumentation.ts`의 백그라운드 잡 2개**(검색량 급상승 스냅샷 — 섹션 6.3, 12시간 주기 / 뉴스레터 발송 — 섹션 6.4, 7일 주기)도 서버가 계속 떠 있어야 의미가 있음 — 서버리스로 옮기면 Railway Cron 등 외부 스케줄러로 교체해야 함.
- **Docker로 배포** — `Dockerfile`(멀티스테이지, `next.config.ts`의 `output: "standalone"` 사용) + `.dockerignore` 준비돼 있음. 로컬 검증: `docker build -t easyserch .` → `docker run -p 3000:3000 --env-file .env.local easyserch`.
- **환경변수** — `.env.example` 참고, 실제 값은 `.env.local`(gitignore됨)에. 필수: `NAVER_API_KEY`/`NAVER_SECRET_KEY`/`NAVER_CUSTOMER_ID`(검색광고), `NAVER_OPENAPI_CLIENT_ID`/`NAVER_OPENAPI_CLIENT_SECRET`(오픈API), `NOTION_TOKEN`+DB ID 9개(세션/키워드결과/블로그지수세션/블로그지수결과/문의/`NOTION_KEYWORD_SNAPSHOTS_DB_ID`/`NOTION_VISITS_DB_ID`/`NOTION_SUBSCRIBERS_DB_ID`/`NOTION_USERS_DB_ID`), `RESEND_API_KEY`+`CONTACT_EMAIL_TO`(문의하기, 섹션 12.3 — 뉴스레터 발송/회원가입 인증메일도 같은 `RESEND_API_KEY` 재사용, 섹션 6.4·16), `ADMIN_PASSWORD`(관리자 로그인, 섹션 12.2), `ANTHROPIC_API_KEY`+`AUTH_EMAIL_FROM`(AI 블로그 글쓰기, 섹션 16). `NOTION_PARENT_PAGE_ID`는 `scripts/setup-notion*.ts` 최초 1회 실행 때만 필요하고 런타임에는 불필요. **`.env.local.example` 같은 별도 예시 파일을 새로 만들지 말 것** — 예전에 낡은 사본이 실수로 방치돼 삭제된 적 있음(섹션 10.2에서 삭제한 변수들이 그 파일엔 여전히 남아 있었음), `.env.example` 하나만 유지.
- **헬스체크** — `GET /api/health`, Notion/네이버 호출 없이 즉시 200 반환 (플랫폼 헬스체크가 API 쿼터를 깎아먹지 않도록 의도적으로 아무것도 조회하지 않음).
- **포트** — standalone 서버(`server.js`)는 `PORT` 환경변수를 자동으로 읽음(기본 3000, `HOSTNAME=0.0.0.0`) — 플랫폼이 지정하는 포트를 그대로 주입하면 됨.

## 12. 공통 페이지 (`/guide`, `/admin`, `/contact`)

개인 도구/블로그지수 어느 한쪽에도 속하지 않는 사이트 전역 페이지들.

### 12.1 가이드 (`/guide`, `/guide/[slug]`)

- 콘텐츠 마케팅 목적의 정적 글 목록. `src/lib/guide/articles.ts`의 `GUIDE_ARTICLES` 배열(현재 5편)에 슬러그·제목·설명·발행일·본문(`sections[]`)을 하드코딩 — 별도 CMS나 Notion DB 없음, 글을 추가/수정하려면 이 배열을 직접 편집.
- `/guide/[slug]`는 `generateStaticParams()`로 빌드 타임에 전부 SSG되고, 각 글은 `Article` JSON-LD(제목/설명/발행일/작성자)를 방출함.
- 글 하단에 "관련 가이드" 섹션이 있는데, `getRelatedGuideArticles(slug)`가 **현재 글을 제외한 나머지 전부**를 반환하는 방식이라 글을 추가할수록 관련 링크도 자동으로 늘어남 — 수동으로 링크를 관리할 필요 없음.
- `sitemap.ts`가 `GUIDE_ARTICLES`를 순회해 각 글의 sitemap 항목을 자동 생성하므로, 배열에 새 글을 추가하면 sitemap도 별도 수정 없이 따라감.

### 12.2 관리자 (`/admin`)

- **2026-07부터 비밀번호로 보호됨 — 사이트에서 로그인이 있는 유일한 페이지.** 나머지 사이트 전체(개인 도구/블로그지수/급상승/가이드/문의)는 섹션 10.2 원칙 그대로 로그인 없음. `src/proxy.ts`가 `/admin/**`(단 `/admin/login` 제외)을 가로채 `admin_auth` 쿠키를 `ADMIN_PASSWORD` 환경변수와 비교하고, 불일치하면 `/admin/login`으로 리다이렉트. 로그인 성공 시 쿠키 값 = `ADMIN_PASSWORD` 그대로(httpOnly+secure+sameSite strict, 30일) — 단일 관리자용 게이트라 해싱 같은 추가 장치는 의도적으로 생략함. Supabase/OAuth(섹션 10.2에서 이미 삭제)는 다시 쓰지 않음.
- `metadata.robots = { index: false, follow: false }`는 `src/app/admin/layout.tsx`에서 `/admin`·`/admin/login` 공통으로 한 번만 선언.
- **방문자 추적**: 이 프로젝트 최초의 방문자 카운트 인프라. `src/proxy.ts`가 `ez_v` 쿠키가 없는 페이지 요청(API/관리자 경로 제외)마다 `crypto.randomUUID()`로 새 값을 발급해 다음 KST 자정에 만료되는 쿠키로 세팅하고, `event.waitUntil()`로 감싼 fire-and-forget `fetch`를 `/api/visit`(Node 런타임)에 보내 Notion `방문 기록` DB(`src/lib/notion/visits.ts`)에 1행 적재함. 쿠키가 매일 자정 만료되므로 "오늘 방문자"는 자연스럽게 순방문자 기준이 되고, 인메모리 카운터와 달리 재배포에도 숫자가 안 사라짐 — 대신 방문자가 쿠키를 지우면 중복 집계될 수 있음(허용 가능한 근사치, 이 프로젝트의 다른 "대략적 지표"들과 같은 수준의 트레이드오프).
- **유입 경로/진입 페이지 분석** (2026-07 추가): 같은 첫 방문 시점에 `Referer` 헤더와 요청 경로를 `src/lib/utils/visitTracking.ts`의 `categorizeReferrer`/`categorizeLandingPage`로 고정된 소수 카테고리(네이버/구글/카카오/인스타그램/페이스북/다음/사이트 내 이동/직접 방문, 홈/검색 결과/블로그지수 입력·결과/검색량 급상승/가이드/문의하기)로 정규화해 `방문 기록` DB의 `유입경로`·`진입 페이지` select 속성에 같이 저장함 — URL을 그대로 저장하면 select 옵션이 방문마다 하나씩 늘어나 관리자 화면에서 집계가 안 되므로, **반드시 proxy.ts 단계에서 정규화한 값만 저장할 것**(원본 URL이 필요해지면 별도 rich_text 속성을 추가할 것이지 이 select 속성의 카테고리를 세분화하지 말 것). `/admin`의 "방문자 유입 분석" 카드(`VisitBreakdownCard.tsx`, `getVisitBreakdownToday()`)가 오늘 하루 치를 유입경로별·진입페이지별로 집계해 보여줌 — Notion에 GROUP BY가 없어서 `countVisitsToday()`와 같은 방식으로 오늘 치를 페이지네이션하며 훑어 JS에서 집계함(범위가 하루뿐이라 비용 작음). 이 두 속성은 `scripts/add-visit-tracking-props.ts`로 기존 `방문 기록` DB에 추가한 것 — DB를 새로 만드는 `setup-notion-visits.ts`와 달리 기존 데이터를 건드리지 않는 1회성 마이그레이션 스크립트이니 그대로 두고 다시 실행하지 말 것(속성이 이미 있으면 멱등이라 다시 돌려도 무해하긴 하지만 불필요함).
- 통계 카드 4개(오늘 키워드 검색/방문자/문의 메일/블로그지수 확인, `src/lib/notion/{sessions,visits,inquiries,blogScoreSessions}.ts`의 `count*Today()` 함수들) + 최근 7일 검색 키워드 카드 로그(`getSessionsInRange(7)`, `WeeklySearchLogCards.tsx`) + **최근 7일 블로그지수 확인 카드 로그**(2026-07 추가, `getBlogScoreSessionsInRange(7)`, `WeeklyBlogScoreLogCards.tsx` — 도메인/키워드 개수/비교 블로그 개수 표시, `/dashboard/[sessionId]`로 링크) — 예전의 "최근 50건 리스트"(`RecentSessionsList.tsx`, `getRecentSessions()`)는 검색 키워드 쪽 7일 카드 로그와 목적이 겹쳐서 삭제하고 대체함.
- 날짜 경계는 전부 `src/lib/utils/formatDate.ts`의 `getKstDateString()`/`kstDayRangeUtcIso()` 사용 — 섹션 15의 타임존 버그와 같은 이유로, 서버 UTC 기준 "오늘"과 KST 기준 "오늘"이 달라지지 않게 함.

### 12.3 문의하기 (`/contact`)

- `ContactForm.tsx` → `POST /api/contact` → Resend로 이메일 발송(운영자 수신) + Notion `문의` DB에도 백업 저장. 이메일 발송이 우선이라 **Notion 저장이 실패해도 요청은 성공 처리**함(이메일은 이미 갔으므로) — 반대로 `RESEND_API_KEY`/`CONTACT_EMAIL_TO`가 없으면 아예 502로 막음.

### 12.4 개인정보처리방침 (`/privacy`)

- 방문자 추적(섹션 12.2)과 문의하기(이름/이메일)가 실제로 개인정보를 수집하는데 안내 페이지가 없던 걸 2026-07에 채움. `src/app/privacy/page.tsx`에 섹션 배열을 하드코딩(가이드 글과 동일한 패턴) — 실제 수집 항목(방문 통계/문의/뉴스레터 구독/검색·블로그지수 조회 입력값)과 위탁 업체(Notion, Resend)는 코드 기준으로 정확하지만, **보유기간·사업자 정보 등 법적으로 확정이 필요한 부분은 초안 수준**이니 배포 전 실제 운영자가 검토할 것. `metadata.robots = { index:false }`로 검색 노출은 막아뒀고 sitemap에도 안 넣음 — 홈/블로그지수/급상승 푸터의 "개인정보처리방침" 링크로만 접근 가능. 뉴스레터(섹션 6.4) 같은 새 개인정보 수집 지점을 추가할 때마다 이 페이지도 같이 갱신할 것 — 실제 코드보다 뒤처지면 의미가 없음.

### 12.5 업종별 인기 검색어 (`/keywords`, `/keywords/[categoryId]`)

- 홈페이지 카테고리 캐러셀(`CategoryTopKeywordsPanel`, `lib/naver/categoryTrends.ts`)이 쓰는 8개 카테고리 데이터를 독립 URL로도 노출하는 SEO 랜딩 페이지(2026-07 추가) — 캐러셀 안에만 있으면 검색엔진이 개별 색인을 못 하고 링크 공유도 안 됐던 문제를 해결. `/keywords`는 8개 카테고리 목록, `/keywords/[categoryId]`는 `generateStaticParams()`로 빌드 타임에 SSG되는 카테고리별 TOP10 표 + 쇼핑 관심도(매핑 있는 4개 카테고리만, 섹션 10.3.1과 동일). 새 데이터 소스를 추가하지 않고 기존 `getCategoryTopKeywords`/`getCategoryShoppingDirection`을 그대로 재사용함 — 캐시도 그대로 공유되므로 홈페이지와 이 페이지가 같은 카테고리를 동시에 조회해도 네이버를 중복 호출하지 않음.

## 13. SEO

- **메타데이터**: 루트 `layout.tsx`가 `title.template`("%s — ezzsearch")과 기본 OG/Twitter 카드(이미지 제외)를 설정하고, 각 페이지는 `export const metadata`로 제목/설명만 오버라이드 — 새 페이지 만들 때 이 패턴을 따를 것(OG 태그를 페이지마다 새로 정의할 필요 없음).
- **OG/Twitter 이미지** (2026-07): 예전엔 로고 원본(1285×438, 가로로 긴 배너 비율)을 그대로 썼는데 카카오톡 등 1200×630 비율 카드에서 어색하게 잘렸음 — `src/app/opengraph-image.tsx`(`twitter-image.tsx`는 이걸 재수출)가 `next/og`의 `ImageResponse`로 브랜드 컬러 배경 + "ezzsearch" 워드마크 + 헤드라인을 즉석에서 1200×630으로 렌더링함. **`next/og`(Satori) 기본 폰트엔 한글 글리프가 없어서 한글 텍스트가 빈 박스로 나옴** — Google Fonts의 `css2` 엔드포인트를 구버전 Chrome User-Agent로 요청하면 Satori가 못 읽는 woff2 대신 ttf를 내려주는 방식(실측 확인)으로 Noto Sans KR을 로드해서 씀. 이 우회가 실패하면(폰트 fetch 실패 등) `fontFamily`를 지정 안 한 채로 폴백 렌더링됨 — 그 경우 한글이 깨질 수 있으니 새 OG 이미지 텍스트를 한글로 추가할 때도 이 로딩 함수를 재사용할 것. `layout.tsx`의 `openGraph.images`/`twitter.images`는 이 파일 컨벤션과 중복되므로 의도적으로 비워둠 — 다시 채우지 말 것.
- **JSON-LD**: 루트 레이아웃에 `WebApplication` 스키마 + `SiteNavigationElement`(2026-07 추가, `SiteHeader.tsx`의 `NAV_LINKS`를 그대로 재사용해 실제 내비게이션과 항상 동기화됨 — 구글이 검색결과에 사이트 메뉴를 같이 보여줄지 참고하는 힌트일 뿐 노출을 보장하진 않음), `/guide/[slug]`마다 `Article` 스키마(섹션 12.1). 전부 `<script type="application/ld+json" dangerouslySetInnerHTML>`로 직접 주입 — 별도 라이브러리 없음.
- **사이트맵/robots**: `src/app/sitemap.ts`(evergreen 페이지만: `/`, `/dashboard`, `/trending`, `/keywords`+카테고리별 페이지, `/guide`+개별 글, `/contact` — `/privacy`는 noindex라 의도적으로 제외, 섹션 12.4), `src/app/robots.ts`(`/result/*`, `/dashboard/*`, `/api/`, `/admin` 크롤링 차단 — 1회성 세션 페이지는 thin/duplicate content라 의도적으로 제외). `priority`/`changeFrequency` 값은 구글이 사실상 무시하는 필드라 여기 시간 쓰지 말 것.
- **RSS 피드**: `/guide/rss.xml`(`src/app/guide/rss.xml/route.ts`)이 `GUIDE_ARTICLES`를 RSS 2.0으로 내보냄 — 새 글이 배열에 추가되면 자동 반영. 루트 `layout.tsx`의 `metadata.alternates.types`로 피드 리더가 자동 탐지할 수 있게 링크 태그도 심어둠.
- **네이버 서치어드바이저**: `naver-site-verification` 메타 태그는 `layout.tsx`에 있지만, 사이트 등록·소유확인·사이트맵 제출·웹페이지 수집요청은 서치어드바이저에 로그인해야 하는 작업이라 **사용자가 직접** 해야 함 — 대신 해줄 수 없음. 사이트맵을 재배포해도 서치어드바이저가 자동으로 다시 가져가지 않으므로, 구조가 크게 바뀌면 사용자에게 재제출을 안내할 것.

## 14. 파일 구조 (기능별 폴더 컨벤션)

`src/lib/`, `src/components/`는 **기능 영역별 하위 폴더**로 분류돼 있음 (2026-07 재구성). 새 파일을 추가할 때 아래 기준을 따를 것:

| 폴더 | 소속 | 기준 |
|---|---|---|
| `lib/dashboard/`, `components/dashboard/` | 블로그지수 | `src/app/dashboard/**` 또는 다른 dashboard 파일에서만 import됨 |
| `lib/search/`, `components/search/` | 개인 도구 | `src/app/page.tsx`/`src/app/result/**`에서만 import됨 |
| `components/trending/` | 검색량 급상승 | `src/app/trending/**`에서만 import됨 (lib 쪽은 `lib/googleTrends/`·`lib/notion/keywordSnapshots.ts`·`lib/scheduler/`로 기술적 계층별 분리 — 아래 참고) |
| `components/admin/` | 관리자 | `/admin`에서만 import됨 |
| `lib/write/`, `components/write/` | AI 블로그 글쓰기 | `src/app/write/**`·`src/app/api/write/**`·`src/app/api/auth/**`에서만 import됨 (Notion 계정 CRUD는 다른 DB 접근과 동일하게 `lib/notion/users.ts`) |
| `lib/naver/`, `lib/notion/`, `lib/utils/` | 공유 | 네이버 API 클라이언트 / Notion 클라이언트+스키마 / 범용 유틸 — 두 제품 이상이 함께 쓰는 것 확인 후에만 여기 둘 것 |
| `components/` 최상위, `lib/constants.ts` | 공유 | `SiteHeader`/`Reveal`/`PainPointPromo`/`AmbientParticles`/`SearchProgressModal`/`ContactForm`/`MobileStickyCta`/`MobileNavMenu`/`ScrollProgressBar`처럼 두 제품 이상에서 쓰는 것 |
| `src/app/**` | 라우팅 | **절대 이 컨벤션으로 옮기지 않음** — 파일 위치 자체가 Next.js 라우팅 규칙 |

새 파일이 특정 기능에서만 쓰이는지 애매하면 `grep`으로 실제 importer를 확인한 뒤 폴더를 정하고(감으로 정하지 말 것), 파일 1개짜리 폴더(`lib/googleTrends/`, `lib/guide/`, `lib/scheduler/`, `lib/search/`)라도 나중에 같은 영역 파일이 늘어날 걸 감안해 미리 분리해두는 쪽을 기본값으로 삼음.

## 15. 알아둘 것 (자주 재발하는 실수)

- **날짜 표시는 항상 `formatKstDateTime()`(`src/lib/utils/formatDate.ts`) 사용, `new Date(x).toLocaleString("ko-KR")` 직접 쓰지 말 것.** locale은 표기 형식만 정하고 타임존은 안 정하기 때문에, 서버가 UTC로 도는 배포 환경(Railway 기본값)에서는 실제 한국 시간보다 9시간 어긋나게 표시됨 — 실제로 이 버그가 있었고(`/admin` 최근 검색 시간이 안 맞는다는 리포트) 사이트 전체 8곳에서 같은 실수가 반복되고 있었음.
- **네이버 검색광고 `hintKeywords` 파라미터는 공백이 섞이면 400 에러**(실측 확인, 섹션 6.3). 여러 단어로 된 후보 키워드를 조회할 땐 공백을 제거하고 보낼 것.
- **`src/lib/naver/throttle.ts`의 공유 스로틀(최소 1초 간격, 오픈API+데이터랩 공용)은 병렬화로 못 줄임** — 새로 느린 검색 기능을 만들 때 이 제약을 우회하려 하지 말고, 대신 반복 조회되는 키워드에 TTL 캐시를 씌우는 쪽으로 최적화할 것(`blogPublishStats.ts`의 3시간 캐시가 그 예).
- **Notion `date`/`created_time` 필터에 `on_or_after`와 `before`를 같은 조건 객체 안에 같이 넣으면 두 조건이 AND로 안 묶인다**(실측 확인 — `/admin`의 "오늘" 통계 3개가 최대 4일치 데이터를 합산해서 보여주고 있던 실제 버그의 원인이었음, `countSessionsToday`/`countInquiriesToday`/`countBlogScoreSessionsToday`). `{ property, date: { on_or_after: a, before: b } }` 하나로 쓰지 말고, 반드시 `{ and: [{ property, date: { on_or_after: a } }, { property, date: { before: b } }] }`처럼 조건을 둘로 쪼개서 `and`로 묶을 것 — `keywordSnapshots.ts`의 중복 체크 쿼리가 이미 이 올바른 패턴을 쓰고 있으니 참고. 새로 날짜 범위 필터(오늘/최근 N일 등)를 추가할 때마다 이 패턴을 따를 것.
- **미들웨어(`src/proxy.ts`)에서 자기 자신의 공개 도메인(`https://ezzsearch.com`)으로 다시 `fetch`를 보내면 Railway 컨테이너 안에서 TLS 핸드셰이크가 깨진다**(실측 확인 — "SSL routines:ssl3_get_record:wrong version number" 에러로 방문 기록 `fetch`가 계속 조용히 실패해서, 실제 검색·블로그지수 확인은 정상적으로 쌓이는데 "오늘 방문자"만 0으로 나오는 불일치가 있었음. 브라우저가 직접 보내는 요청은 이 경로를 안 타므로 영향 없었음). 미들웨어가 같은 프로세스의 다른 라우트를 호출해야 하면 `new URL(path, origin)`(공개 HTTPS 도메인) 대신 `http://127.0.0.1:${process.env.PORT ?? 3000}` 로컬 루프백으로 보낼 것 — TLS 자체가 필요 없어져서 이 문제를 피해간다.

## 16. AI 블로그 글쓰기 (`/write`, 2026-07 구현 완료)

사진 여러 장 + 프롬프트 한 줄만 입력하면 Claude API(Anthropic)가 네이버 블로그에 바로 붙여넣을 수 있는 완성된 글(제목+본문+사진 삽입 위치+추천 썸네일)을 생성해주는 페이지. 개인 도구/블로그지수 어느 쪽도 아닌 제3의 독립 기능 — §0의 "사이트 공통 기능" 성격. 실제 프롬프트 엔지니어링(시스템 프롬프트 전문)과 구현 레시피는 `.claude/skills/ai-blog-writer/SKILL.md`에 — 이 기능을 다시 손볼 때는 그 스킬을 먼저 참고할 것.

- **저장 없음** — 완성된 글은 이 사이트에 게시되지 않고 화면에서 복사해서 쓰는 1회성 결과물. 업로드된 사진도 서버에 파일로 남기지 않고 Claude API 요청에만 담아 전송(클라이언트 쪽 미리보기는 브라우저 로컬 blob URL). 외부 이미지 저장소 연동 없음.
- **이 사이트에서 유일하게 로그인이 있는 사용자 기능**(`/admin`과 별개) — Claude API가 요청마다 과금되는데 사이트 전체가 로그인 없는 게 원칙이라, 봇 남용으로 비용이 커지는 걸 막으려고 계정 단위 "하루 1회" 제한을 뒀다(사용자와 논의 후 확정 — 처음엔 방문자 쿠키 기준 제한도 검토했으나, 더 확실한 남용 방지를 위해 정식 계정으로 감). **Supabase/OAuth는 §10.2 결정대로 다시 안 씀** — 이 로그인은 그 방식이 아니라 Notion `사용자 계정` DB에 bcrypt 해시 비밀번호를 저장하는 자체 구현.
- **회원가입 흐름**: `POST /api/auth/signup`(이메일+비밀번호, bcryptjs 해시 저장) → Resend로 인증 메일 발송 → `GET /api/auth/verify?token=`(랜덤 UUID, 1회용) 클릭해야 `이메일인증됨` 체크 → `POST /api/auth/login`으로 세션 발급. 세션은 Notion 유저 레코드에 저장하는 랜덤 토큰(`write_session` 쿠키, httpOnly+secure+sameSite lax, 30일) — 계정당 세션 1개만 유지(재로그인하면 이전 세션 무효화). `src/lib/write/auth.ts`의 `getCurrentUser()`가 쿠키→세션토큰→Notion 조회까지 한 번에 처리, 페이지(Server Component)와 API 라우트 양쪽에서 재사용.
- **네이버·카카오 로그인도 지원** (2026-07 추가) — `GET /api/auth/naver`·`/api/auth/kakao`가 각각 CSRF 방지용 `state`를 발급(`src/lib/write/socialAuth.ts`, 10분짜리 `write_oauth_state` 쿠키)하고 제공자 인증 화면으로 리다이렉트, `/api/auth/{naver,kakao}/callback`이 코드를 토큰으로 교환→프로필 조회→`findUserByProvider`(이메일이 아니라 `가입방식`+`소셜ID` 조합으로 조회 — 이메일이 없거나 바뀌어도 안전) 후 없으면 `createSocialUser`로 즉시 계정 생성. **소셜 로그인은 발급처가 이미 신원을 확인한 것이므로 이메일 인증 메일 없이 바로 `이메일인증됨=true`.** 이메일+비밀번호 로그인은 그대로 유지(대체 아니라 추가 옵션) — Supabase/OAuth를 다시 안 쓴다는 §10.2 결정은 "블로그지수 전체를 로그인 기반 업체등록 시스템으로 되돌리지 않는다"는 뜻으로 재해석해 이 기능 하나에 한해 예외를 둠(사용자와 논의 후 결정). 실패 시(설정 안 됨, state 불일치, 토큰/프로필 조회 실패) 전부 `/write?error=...`로 리다이렉트해서 `AuthForms.tsx`가 쿼리 파라미터로 에러 메시지를 보여줌.
- **카카오는 사업자 전환 없이 진행하기로 확정**(사용자 결정) — 카카오는 이메일 동의항목을 개인 개발자 앱에 기본 허용 안 해서, `/api/auth/kakao`가 `scope=profile_nickname`만 요청함. 콜백에서 이메일이 없으면 닉네임(기본 제공 동의항목)을 대신 표시 이름으로 저장 — 그마저 없으면 "카카오 사용자". 소셜 계정은 title(이메일 자리)이 아니라 `가입방식`+`소셜ID`로 조회하므로 이 표시 이름이 닉네임이라 겹치거나 비어 있어도 로그인 로직엔 영향 없음(순수 표시용). 나중에 사업자 전환하면 이메일 동의항목을 다시 켜고 `scope`에 `account_email` 추가하면 됨.
- **일일 제한 로직**: Notion 유저 레코드의 `마지막사용일`(KST 날짜 문자열)이 오늘과 같으면 차단(`hasUsedToday()`, `src/lib/notion/users.ts`) — 이 사이트의 다른 "오늘" 판정과 동일하게 `getKstDateString()` 기준. **Claude 호출이 실제로 성공했을 때만** `markUsedToday()`를 호출하도록 `/api/write`에서 순서를 맞춰뒀음 — 검증 실패나 API 오류로 실패한 시도까지 하루치를 소진시키면 안 되기 때문(실측 확인: 실패한 요청 뒤 `마지막사용일`이 그대로 비어있음, 성공한 요청 뒤엔 오늘 날짜로 세팅됨, 그 상태에서 재요청하면 429).
- **입력 제한** (`/api/write`, `src/app/api/write/route.ts`): 사진 최대 10장, 장당 5MB, **총합 18MB**, jpg/png/webp/gif만 허용, 프롬프트 500자 — 전부 서버에서 강제(총합 체크는 `BlogWriterForm.tsx`에도 동일하게 있어 제출 전에 먼저 걸러줌). **총합 캡이 따로 있는 이유**(2026-07, 사용자 문의로 확인): Claude API 요청 전체 크기 한도가 32MB(base64 인코딩 포함)인데, base64는 원본보다 약 4/3배 커지므로 장당 5MB 제한만 있으면 10장을 각각 5MB로 채웠을 때(원본 50MB → base64 약 66MB) 그 한도를 훌쩍 넘어 요청 자체가 거절됨 — 그래서 "개수"와 "장당 용량"이 각각 통과해도 "합계"가 별도로 18MB(base64 환산 시 약 24MB, 32MB 한도에 여유를 둔 값) 이하인지 반드시 같이 검사해야 함. 사진 장수를 더 늘리려면 이 총합 캡과 장당 캡을 재계산해서 같이 낮춰야 함(예: 총합은 유지하고 장당 캡만 낮추는 식).
- **Claude 호출**: `src/lib/write/blogWriter.ts` — `@anthropic-ai/sdk`로 이미지 base64 + 프롬프트를 한 메시지에 담아 전송, 응답은 JSON(title/body/recommendedThumbnail/thumbnailReason/tags/stockImageQueries)만 오도록 시스템 프롬프트로 강제하고 방어적으로 파싱(앞뒤에 다른 텍스트가 붙어도 첫 `{`~마지막 `}`만 추출). `thumbnailReason`은 Claude가 가끔 빈 문자열로 줄 때가 있어서(실측 확인) UI에서 비어있으면 "— 이유" 부분 자체를 안 보여주게 처리.
- **글 유형별 작성 규칙** (2026-07 추가): 사용자가 프로젝트 루트 `new_blog/`(git 미추적 폴더 — 코드가 아니라 콘텐츠 규칙 문서라 의도적으로 `src/` 밖에 둠)에 5개 유형별 규칙 문서(`블로그글쓰기규칙_정보노하우형.md`/`_리뷰후기형_내돈내산.md`/`_리뷰후기형_협찬체험단.md`/`_일상에세이형.md`/`_홍보광고형.md`)와 공통 규칙을 담은 `_개요.md`를 직접 작성해 관리함 — **이 폴더가 규칙의 원본(source of truth)**, 코드에 규칙 텍스트를 하드코딩하지 말 것. 유형 결정은 사용자가 고르는 게 아니라 **프롬프트에서 자동 분류**됨(아래 항목) — `src/lib/write/blogRules.ts`(서버 전용, `fs.readFileSync`)가 분류된 유형에 맞는 `.md` 파일을 런타임에 읽어 `_개요.md`의 공통 규칙과 합쳐 시스템 프롬프트에 첨부함(`blogWriter.ts`) — 협찬/홍보 유형은 공정위 표기 문구까지 파일에 명시돼 있어 별도 코드 로직 없이 시스템 프롬프트 지시만으로 반영됨. **카테고리 메타데이터(id/label)는 `blogCategories.ts`(fs 없음, 클라이언트 컴포넌트에서 import 가능)와 실제 파일 읽기(`blogRules.ts`, fs 사용, 서버 전용)를 분리해뒀음** — 클라이언트 컴포넌트(`BlogWriterForm.tsx`)가 실수로 `blogRules.ts`를 import하면 `fs`가 브라우저 번들에 걸려 빌드가 깨지므로, 새 카테고리 관련 클라이언트 코드는 반드시 `blogCategories.ts`만 참조할 것. `next.config.ts`의 `outputFileTracingIncludes`에 `new_blog/**`를 강제 포함시켜뒀음(garu-ko wasm과 같은 이유 — `fs`로 런타임에 읽는 파일은 Next의 자동 파일 트레이싱이 못 잡아서 standalone Docker 빌드에서 빠짐, 실측으로 `.next/standalone/new_blog/`에 파일이 들어가는 것 확인함). 새 유형을 추가하려면 `new_blog/`에 `.md` 파일을 추가하고 `BLOG_CATEGORIES`(blogCategories.ts)와 `RULE_FILES`(blogRules.ts) 양쪽에 등록할 것.
- **유형 자동 분류 + 태그·스톡이미지 추천 + 반자동 발행 흐름** (2026-07 추가, 사용자와 논의 후 확정): 원래는 "프롬프트만 넣으면 네이버 블로그에 완전 자동 발행"을 요청받았으나, 조사 결과 **네이버 블로그 글쓰기 오픈API(`writePost.json`)는 광고성 스팸 남용 때문에 2020년 5월 6일부로 완전히 폐지되어 현재 신청 자체가 불가능함**(뉴스 확인) — 그래서 "완전 자동 발행"은 실현 불가능한 전제였고, 사용자와 다시 논의해 **반자동** 방식으로 확정함:
  - **유형 자동 분류**: `src/lib/write/classifyCategory.ts`가 본 생성 호출 전에 저비용 모델(`claude-haiku-4-5`)로 프롬프트만 보고 5개 유형 중 하나를 강제 tool-call(`tool_choice: {type:"tool"}`)로 분류함 — JSON 텍스트 파싱이 아니라 강제 tool 스키마를 쓴 이유는 분류 하나만 필요한 요청에서 "앞뒤에 텍스트 섞임" 실패 모드를 아예 없애기 위함. 분류 실패 시(Haiku 오류 등) `정보노하우형`으로 폴백하고 절대 throw 안 함 — 분류 단계 문제로 하루 1회뿐인 본 생성 시도를 날리면 안 되기 때문. `/write` 폼의 수동 유형 드롭다운은 제거함.
  - **추천 태그**: `blogWriter.ts`의 JSON 응답 스키마에 `tags`(한국어 해시태그 5~8개) 필드를 추가 — 네이버 공식 API에 애초에 태그 파라미터가 없었으므로(§ 아래 API 조사 참고) 자동 삽입이 아니라 "복사해서 붙여넣는" 용도.
  - **추천 스톡 이미지**: `src/lib/write/imageSearch.ts`가 Pixabay 무료 이미지 검색 API(`GET https://pixabay.com/api/`, `PIXABAY_API_KEY` 필요)를 호출 — `stockImageQueries`(Claude가 뽑은 영어 검색어, Pixabay 태그가 영어 위주라서)로 조회. `PIXABAY_API_KEY` 미설정이거나 호출 실패 시 **절대 throw 안 하고 빈 배열만 반환**(section 10.3의 `settle()`과 같은 원칙) — 부가 기능이 나머지 글 생성 응답을 막으면 안 됨. Pixabay 결과 `webformatURL`은 24시간 만료되는 임시 링크라 그 세션에서 한 번만 보여주고 저장/재서빙 안 함(Pixabay 약관상 영구 핫링킹 금지와 일치).
  - **네이버 블로그 아이디 저장**: "네이버 블로그 글쓰기 열기" 버튼이 `https://blog.naver.com/{아이디}?Redirect=Write&`을 새 탭에 여는데, 네이버 로그인 프로필 응답(§ 위 네이버/카카오 로그인 항목)에는 이 블로그 주소 슬러그가 없음(오픈API의 `id`는 앱별 해시일 뿐 블로그 URL과 무관) — 그래서 계정에 1회 입력받아 저장(`USER_PROPS.naverBlogId` = `네이버블로그ID`, `scripts/add-user-naver-blog-id-prop.ts`로 마이그레이션, `setNaverBlogId()`)해두고 재사용. 저장 전용 라우트 `POST /api/write/naver-blog-id`를 `/api/write`(하루 1회 제한 걸린 유료 호출)와 분리한 이유: 이 필드는 무료고 여러 번 고칠 수 있어야 해서 일일 제한 로직과 섞으면 안 됨.
  - **최종 발행은 여전히 사용자가 직접**: 결과 화면에 제목/본문/태그/스톡이미지 추천을 다 보여주고, "네이버 블로그 글쓰기 열기" 버튼으로 새 탭을 띄운 뒤 사용자가 복사·붙여넣기 후 직접 "등록" 버튼을 누름. 서버가 대신 로그인하거나 브라우저를 조작하는 방식(계정 크레덴셜 저장, 세션 하이재킹 등)은 검토했으나 채택하지 않음 — 네이버가 바로 이런 자동발행 패턴 때문에 위 API를 폐지한 전례가 있어 계정 제재 리스크가 있고, 이 프로젝트가 지금까지 지켜온 "공식 API만, 스크래핑은 승인된 예외만"(§10.4) 원칙과도 맞지 않음. 진짜 "에디터에 자동 입력"을 원하면 브라우저 확장/북마클릿을 별도 프로젝트로 설계해야 함(사용자에게 이렇게 안내하고 반자동으로 진행하기로 결정).
- **본문 마크업(소제목·강조·이미지 자리) + 서식 포함 복사 + AI 이미지 생성 + 사진 선택사항화** (2026-07 추가, 사용자 요청): 사용자가 "제목에 [광고] 표기가 보기 싫다 / 소제목·강조 서식을 지정하고 싶다 / [사진N] 자리에 실제 사진이 보였으면 / 사진 없이도 글을 쓰고 싶다 / 스톡 이미지를 클릭하면 바로 본문에 들어갔으면 / 제품 비교 이미지처럼 실사진으로 안 되는 건 AI가 직접 생성했으면" 요청.
  - **제목에서 광고 표기 제거**: `new_blog/블로그글쓰기규칙_리뷰후기형_협찬체험단.md`·`_홍보광고형.md`를 고쳐서(원본 소스이므로 여기부터 고침, 섹션 위 "글 유형별 작성 규칙" 참고) 공정위 표기(제목 또는 본문 둘 다 허용됨)를 **본문 첫 줄에만** 넣도록 통일. `blogWriter.ts`의 `stripAdTagFromTitle()`이 `[광고]`/`[협찬]`/`#광고` 패턴을 제목에서 방어적으로 한 번 더 걷어냄(모델이 지시를 놓쳐도 최종 안전망).
  - **본문 마크업 스키마**: `blogWriter.ts` 시스템 프롬프트가 소제목은 줄 앞에 `## `, 강조는 `**문구**`, 사용자 사진은 `[사진N]`(N=업로드 순서, 사진이 0장이면 이 표시 자체를 쓰지 않도록 지시), 스톡 이미지 자리는 번호 없는 `[스톡이미지]`(반복 가능), AI 생성 이미지는 `[AI이미지N]`을 쓰도록 지시함. `src/lib/write/parseBody.ts`(fs 없는 순수 파서, 클라이언트/서버 공용)의 `parseBody()`가 이 마크업을 블록·인라인 구조로 파싱하고, `BlogWriterForm.tsx`가 이걸로 실제 화면 미리보기(소제목은 굵고 큰 글씨, 강조는 브랜드색 볼드, 이미지 자리는 실제 사진/스톡/AI 이미지로 치환)를 렌더링함 — 더 이상 `[사진1]`이 리터럴 텍스트로 안 보이고 실제 이미지가 보임.
  - **"서식 포함 복사" (Clipboard API 멀티타입)**: 네이버 SmartEditor는 별도 API가 없어(§16 위 조사 참고) 결국 사람이 복사·붙여넣기 해야 하는데, 기존엔 순수 텍스트만 복사돼서 굵기·소제목이 다 사라졌음. `navigator.clipboard.write([new ClipboardItem({'text/html':..., 'text/plain':...})])`로 `text/html`도 같이 써서, 대상 에디터가 리치 붙여넣기를 지원하면 굵게·소제목·목록 서식이 그대로 붙여넣어지게 함(`parseBody.ts`의 `renderBodyToHtml()`) — 표준 브라우저 Clipboard API만 쓰는 것이라 서버 자동화나 스크래핑이 아님. 서식이 안 먹는 경우를 대비해 "텍스트만 복사"(마크업 기호를 제거하는 `stripBodyMarkup()`) 버튼도 그대로 유지. **이미지는 이 방식으로 안 옮겨진다는 것을 실측으로 확인함**(2026-07, 아래 항목 참고) — `<img>` 자체를 넣지 않음.
  - **스톡 이미지 클릭 = 본문에 삽입**: 기존엔 스톡 이미지 썸네일이 Pixabay 원본 페이지로 링크만 됐는데, 이제 클릭하면(다시 클릭 시 해제) `insertedStockImages` 상태에 순서대로 쌓여서 미리보기의 `[스톡이미지]` 자리에 클릭한 순서대로 채워짐(`parseBody.ts`의 `createImageResolver()`가 매 렌더마다 새 카운터로 순서대로 소비) — "서식 포함 복사"에도 그대로 반영됨.
  - **AI 이미지 생성 (OpenAI 연동, 사용자와 논의 후 확정)**: 제품 비교그래픽처럼 실사진·스톡사진으로 대체 안 되는 경우에 한해 Claude가 `aiImagePrompts`(원래 0~2개 제한이었으나, 제품을 여러 개 비교하는 등 맥락상 여러 장이 실제로 필요할 땐 막지 말아달라는 사용자 요청으로 2026-07에 **최대 5개**로 상향 — `blogWriter.ts`의 `parseResult()`가 이 5개를 최종 하드 캡으로 강제, 모델이 지시를 안 지켜도 비용 폭주 방지)를 응답에 담고, `src/lib/write/generateAiImages.ts`가 OpenAI Images API(`POST https://api.openai.com/v1/images/generations`, 모델 `gpt-image-1`, 공식 문서로 스펙 확인 후 구현 — 추측 없음)를 호출해 `data[].b64_json`을 `data:image/png;base64,...`로 바로 씀(별도 호스팅 불필요). Pixabay와 동일한 계약: **`OPENAI_API_KEY` 미설정이거나 실패해도 절대 throw 안 하고 해당 자리만 `null`**, 나머지 응답은 정상 반환. `generateAiImages`는 입력 `prompts`와 항상 1:1 길이·순서로 반환함(실패한 항목을 배열에서 걸러내면 `[AI이미지N]`의 번호가 밀려서 엉뚱한 이미지가 매칭되는 버그가 생기므로, 실패 시 그 자리에 `null`을 유지). **이미지 1장당 실제로 과금됨**(Claude/Pixabay보다 비쌈) — 테스트할 때 비용 인지할 것. **프롬프트 언어 관련 실사용 이슈(2026-07)**: 처음엔 "이미지 생성 모델은 영어 프롬프트에서 품질이 좋다"는 이유로 `aiImagePrompts`를 통째로 영어로만 쓰게 했더니, 한국어 블로그용 이미지인데도 이미지 안에 렌더링되는 글자(제품명·가격·라벨 등)까지 전부 영어로 나오는 문제가 있었음 — 구도·스타일 지시는 영어로 두되, **이미지 안에 실제로 보일 글자는 한국어 그대로 큰따옴표로 인용하고 "번역하지 말고 그대로 렌더링하라"고 명시**하도록 시스템 프롬프트를 수정함(`blogWriter.ts`). **2026-07 후속 재검증**: `OPENAI_API_KEY` 발급 후 실제 `gpt-image-1` 호출로 재확인함 — 영어가 아니라 한국어로 렌더링되는 것은 확인됨(핵심 수정 사항 유효), 다만 글자 단위 정확도까지는 보장되지 않음(실측: "아메리카노"가 "아페리카노"로, "카페라떼"가 "카페라페"로 한 글자씩 틀리게 나온 사례 확인) — 이미지 생성 모델의 비라틴 문자 렌더링 한계이지 프롬프트 구성의 버그는 아님. **2026-07 추가 개선**: 사용자가 실사용 중 한글 깨짐이 심하다고 신고해 두 가지를 같이 적용함 — (1) 시스템 프롬프트에 "이미지 속 한글 텍스트는 짧고 간단하게(단어 1~3개, 항목당 2~5글자 이내), 크고 굵고 단순한 글자체로" 지시를 추가(길고 작은 글자일수록 오타 확률이 높다는 게 실측상 패턴이었음), (2) `generateAiImages.ts`의 OpenAI `quality`를 `medium`→`high`로 상향(이미지 1장당 비용은 늘어나지만 글자 정확도를 우선하기로 사용자와 합의). 두 변경을 함께 적용해 재검증한 결과 "아메리카노"·"라떼" 모두 완벽하게 렌더링됨(이전엔 "아메리카노"→"아페리카노"로 한 글자 틀렸었음) — 다만 표본이 작아 100% 해결이라 단정할 수는 없고, 정확한 글자가 특히 중요한 경우(정확한 가격·제품명 전문 등)는 이미지 안에 넣기보다 캡션이나 본문으로 따로 설명하도록 프롬프트에도 명시해둠.
  - **사진 선택사항화**: `/api/write`의 "사진을 1장 이상 올려주세요" 검증을 제거, `generateBlogPost`도 빈 배열을 그대로 받아들임. 사진이 0장이면 `recommendedThumbnail`은 0(센티널값, "추천 썸네일 없음")으로 응답하도록 시스템 프롬프트에 지시하고 `parseResult()`가 `imageCount === 0`이면 무조건 0으로 강제함 — UI는 `recommendedThumbnail > 0`일 때만 추천 썸네일 섹션을 보여줌.
- **생성된 글 수정 요청** (2026-07 추가, 사용자 요청): 결과 화면에 "제목을 더 짧게 해줘" 같은 짧은 지시를 넣으면 그 글을 다시 쓰는 기능. 새 라우트 `POST /api/write/revise`(`src/app/api/write/revise/route.ts`)로 분리하고 `/api/write`(하루 1회 제한 걸린 최초 생성)와는 의도적으로 다르게 취급함 — 최초 생성 없이는 수정할 글 자체가 없으니 "하루 1회 이미 씀"이 전제인 상태에서만 도달 가능한 화면이라, 수정 요청까지 또 하루 1회 제한을 걸면 사실상 못 쓰는 기능이 됨. 대신 무제한 재호출로 비용이 새는 걸 막기 위해 **이 라우트 자체에 별도의 낮은 상한(글 하나당 최대 5회, `MAX_REVISIONS`)**을 두고 서버가 클라이언트가 보낸 `revisionCount`를 다시 검증함(클라이언트 신뢰 안 함 — 다만 이 기능도 로그인+이메일인증이 이미 전제라 완전한 방어는 아니고 §16의 기존 방어선과 같은 수준). `src/lib/write/blogWriter.ts`의 `generateBlogPost`/`reviseBlogPost`는 실제 Claude 호출부(`callClaude`)를 공유 — 시스템 프롬프트·마크업 규칙·JSON 파싱은 완전히 같고, user 턴에 들어가는 텍스트만 다름(수정 시엔 "기존 제목+본문+태그 + 수정 요청 문구"를 통째로 다시 보내 "요청한 부분만 반영하고 나머지는 유지하라"고 지시 — 대화 상태를 유지하는 API가 아니라 매 호출이 독립적인 단발 요청이라 항상 전체 맥락을 다시 줘야 함). 유형(category)은 최초 생성 때 정해진 걸 그대로 유지(재분류 안 함). 사진도 매 수정 요청마다 다시 같이 보냄(수정 요청이 사진 관련일 수 있어서). 응답 후 `insertedStockImages`(클릭으로 끼워 넣은 스톡 이미지 목록)는 리셋함 — 본문이 바뀌면 예전 `[스톡이미지]` 삽입 위치가 안 맞을 수 있어서.
- **실측 확인 후 재설계 — 이미지 붙여넣기 & 태그 일괄 붙여넣기는 네이버 쪽 제약이라 클립보드 포맷팅으로 못 고침** (2026-07, 사용자가 실제 붙여넣기 결과를 보고 신고): 위 "서식 포함 복사"를 실제 네이버 에디터에 붙여넣어본 결과 두 가지가 확인됨 — ① `<img>` 태그는 style을 어떻게 넣어도 붙여넣기에서 통째로 사라짐(글자만 들어감, 즉 네이버가 자기 업로드 경로로 들어오지 않은 이미지는 필터링함), ② 태그 입력창은 텍스트 붙여넣기 자체는 받지만 쉼표를 "구분자"가 아니라 "글자"로 인식해서 `tag1,tag2,tag3`가 태그 하나로 들어감(그 입력창이 Enter/쉼표 **키 입력 이벤트**로만 태그를 분리하지, 붙여넣은 텍스트를 파싱해서 자동 분리하진 않는다는 뜻). 두 문제 다 우리 쪽 포맷을 아무리 바꿔도 못 고치는, 대상 사이트의 붙여넣기 처리 방식 자체의 한계라 다음처럼 우회함(추측으로 재시도하지 말고 이 결론을 그대로 따를 것):
  - **이미지**: `renderBodyToHtml()`이 더 이상 `<img>`를 넣지 않고, 각 이미지 자리에 `<mark>` 스타일의 눈에 띄는 안내 문구("📷 사진1 — 카페 입구 전경 자리 (사진을 직접 끼워 넣어주세요)")만 남김. 대신 화면 미리보기(우리 페이지 안, 붙여넣기와 무관)의 각 이미지마다 "이 사진 다운로드" 링크(`<a download>`)를 추가해서, 사용자가 사진을 저장한 뒤 네이버 에디터에 직접 업로드하도록 함 — 유일하게 항상 되는 방법.
  - **태그**: "전체 복사" 버튼을 없애고, 태그 배지 하나하나를 클릭하면 그 태그 하나만(쉼표 없이) 복사되도록 바꿈(`handleCopySingleTag`) — 사용자가 태그를 하나씩 클릭→붙여넣기→Enter를 반복해야 함. 안내 문구도 이렇게 하라고 명시.
  - **이미지 캡션 자동 삽입** (사용자 요청): 이미지 마크업 토큰에 `: 캡션` 을 붙일 수 있게 확장 — `[사진1: 카페 입구 전경]`, `[스톡이미지: 라떼아트 예시]`, `[AI이미지1: 두 제품 스펙 비교]`. `blogWriter.ts` 시스템 프롬프트가 캡션을 항상 넣도록 지시하고, `parseBody.ts`의 `BodyInline`(image 변형)에 `caption?: string` 필드로 파싱되어 화면 미리보기에서 사진 아래 캡션 텍스트로 표시됨.
  - **소제목·목록 스타일 다양화** (사용자 요청 — "상위 노출 블로그 스타일 분석해서 적용"): 실제 스크래핑 없이(§10.4 원칙상 새 스크래핑 확장은 사용자 승인 필요, 이번엔 일반적인 한국 블로그 타이포그래피 관행 지식만 적용) 소제목엔 "◆" 접두사 + 브랜드색 굵은 글씨 + 밑줄 구분선을, 목록엔 순서 없는 항목은 "▶", 순서 있는 항목은 원문자(①②③...20까지, `CIRCLED_DIGITS` 배열)를 자동으로 붙임 — 모델이 마크업(`## `, `- `, `1. `)만 정확히 지키면 나머지 시각 스타일은 렌더러(`parseBody.ts`의 `renderBodyToHtml()` HTML용 + `BlogWriterForm.tsx`의 `renderPreviewBlocks`/`renderInlineNodes` React용, 둘 다 같은 `parseBody()` 파싱 결과를 공유)가 일괄 적용함. 강조(`**`)도 밑줄 대신 배경 하이라이트(형광펜 느낌)로 바꿔서 예전보다 덜 단조롭게 함. 목록 파싱은 `parseBody()`에서 빈 줄 없이 이어지는 연속된 줄이 전부 `- `(또는 `•`)나 `숫자. ` 패턴이면 그 덩어리를 `type: "list"` 블록으로 묶는 방식(섞여 있으면 그냥 일반 문단으로 처리).
- 필요 환경변수: `ANTHROPIC_API_KEY`(console.anthropic.com에서 별도 발급 — Claude Code/Claude.ai 구독과 무관, **실제 키 발급받아 설정 완료**), `NOTION_USERS_DB_ID`(`scripts/setup-notion-users.ts`로 생성 완료, 소셜 로그인용 속성은 `scripts/add-user-social-login-props.ts`로, 네이버블로그ID 속성은 `scripts/add-user-naver-blog-id-prop.ts`로 추가 완료), `AUTH_EMAIL_FROM`(인증 메일 발신 표시명), `NAVER_LOGIN_CLIENT_ID`/`NAVER_LOGIN_CLIENT_SECRET`(developers.naver.com 앱 등록, 검색광고/오픈API 키와 별개 앱 — **2026-07 발급받아 설정 완료**), `KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`(developers.kakao.com 앱 등록, Client Secret은 카카오 앱에서 켰을 때만 필요 — **2026-07 발급받아 설정 완료**), `PIXABAY_API_KEY`(위 스톡 이미지 추천용, pixabay.com 무료 가입 — **실제 발급받아 설정 완료**), `OPENAI_API_KEY`(위 AI 이미지 생성용, platform.openai.com에서 발급 + 결제수단 등록 필요, 이미지 1장당 과금 — **2026-07 발급받아 설정 완료**, 없어도 나머지 기능은 정상 동작). 네이버/카카오 둘 다 Redirect URI를 `https://ezzsearch.com/api/auth/{provider}/callback`로 정확히 등록해야 함.
- **"서식 포함 복사"의 실제 붙여넣기 검증 상태(2026-07)**: 사용자가 실제 배포 사이트+실제 네이버 에디터로 확인함 — 굵게/소제목 등 텍스트 서식은 붙여넣기에서 유지되지만 이미지·태그 일괄 붙여넣기는 안 됨(원인과 대응은 바로 위 항목 참고, 재설계 완료). **캡션·목록 스타일·per-tag 복사는 아직 재검증 안 됨** — `tsc`/`eslint`/`next build` 클린만 확인, 실제 브라우저 Clipboard API/네이버 에디터 붙여넣기는 사용자가 직접 해봐야 확인 가능한 부분이라 다음 실사용 때 확인 필요.
- **검증 완료 (실제 프로덕션 standalone 서버 + 실제 Notion/Resend/Claude API로)**: 회원가입→이메일 발송→인증→로그인→세션 쿠키→**실제 사진을 업로드해 Claude가 정말 이미지를 보고 이해한 자연스러운 글을 생성**(로고 이미지로 테스트, `[사진1]` 위치 표시 포함)→일일 사용 플래그 세팅→재요청 시 429 차단까지 전부 실측 확인. **2026-07 후속 검증**: 네이버/카카오 Client ID/Secret 발급 완료 후 `GET /api/auth/naver`·`/api/auth/kakao`가 더 이상 503이 아니라 실제 `nid.naver.com`/`kauth.kakao.com` 동의 화면으로 302 리다이렉트하는 것까지 확인함(client_id/redirect_uri/state 파라미터 정상 구성) — 다만 실제 로그인 동의를 완료하는 콜백 이후 흐름은 브라우저로만 확인 가능해 사용자가 직접 테스트 필요. OpenAI `gpt-image-1`도 발급받은 키로 실제 호출해 한국어 렌더링 자체는 확인함(글자 단위 정확도 한계는 위 항목 참고). **유형 자동 분류/태그/블로그ID 저장은 여전히 실제 계정 흐름으로 end-to-end 검증 안 됨** — `PIXABAY_API_KEY`는 발급되어 있으나 실제 스톡 이미지 검색 응답 형식(`hits` 배열, `webformatURL` 필드명)은 아직 실제 요청·응답으로 재확인 안 함.
