# CLAUDE.md — ezzsearch (네이버 키워드 검색량 조회 & 블로그지수)

이 문서는 이 프로젝트에서 작업할 때 참고하는 지침서입니다.

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
- **블로그 지수**: 네이버가 공식적으로 제공한 적 없는 비공식 지표이며, 2025년 12월 네이버가 API 변경으로 외부 조회 경로를 차단해 현재는 공식 수치를 가져올 수 없음 → 대신 실제 검색 키워드 기반 콘텐츠 진단(콘텐츠량/키워드 커버리지/노출순위/최신성/사용자 반응 등, `src/lib/dashboard/contentDiagnostics.ts`의 `RADAR_AXES`)을 자체 종합해 10점 만점으로 환산한 **자체 점수**를 "블로그 지수"로 제공함 — 네이버 공식 지표도, 제3자 블로그 지수 서비스의 산정 방식도 아님을 화면에 항상 명시할 것. 대체 지표인 **블로그 노출 순위**(특정 키워드에서 글이 몇 위에 뜨는지)는 블로그지수 쪽 경쟁사 노출 패널로 구현 완료 (섹션 10 참고)

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
- **자체 스냅샷 축적** — 실제 조회된 키워드의 네이버 검색량을 Notion `키워드 검색량 스냅샷` DB(스키마는 `src/lib/notion/schema.ts`의 `SNAPSHOT_PROPS`)에 날짜별로 쌓아 증가율을 계산(`src/lib/notion/keywordSnapshots.ts`의 `getRisingKeywords`, 최소 20일 이상 간격만 인정). 두 경로로 채워짐: (1) `/api/search`가 검색할 때마다 편승해서 저장(추가 네이버 API 호출 없음), (2) `src/lib/scheduler/snapshotJob.ts`가 카테고리 시드 키워드+현재 구글 트렌드 목록을 12시간마다 훑는 정기 잡. 데이터가 부족하면(신규 배포 직후 등) 정직한 빈 상태 문구를 보여줌 — 없는 상승률을 지어내지 말 것.
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
- **XML 파싱**: fast-xml-parser (구글 트렌드 RSS, 섹션 6.3)
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

- `블로그지수 세션`(내 블로그 도메인/비교 블로그 목록/키워드 목록/부족 항목) + `블로그지수 결과`(도메인별 1행: 종합점수 + `RADAR_AXES` 콘텐츠 진단 축 + 블로그 프로필 스탯 + 최근 댓글수 + 자주 쓰는 단어) 두 DB. 세션-레코드 관계 구조는 개인 도구의 검색세션/키워드검색결과와 동일한 방식.
- **"메인 (블로그지수)" 탭**은 세션 생성 시점에 계산해 Notion에 저장 → 재방문해도 그대로 보여줌.
- **"키워드 노출·빈도" 탭**(키워드검색량/언급량/경쟁사노출/키워드클러스터/데이터랩)은 저장하지 않고 방문할 때마다 라이브 재조회함 — 알려진 트레이드오프(재방문 시 느릴 수 있음). 키워드 20개+비교 블로그 여러 곳처럼 규모가 크면 네이버 오픈API 공유 스로틀(초당 1회) 때문에 전체 재조회가 1분 이상 걸릴 수 있어서 `dashboard/[sessionId]/page.tsx`가 두 가지로 완화함: (1) 이 탭의 패널 4개(키워드검색량/언급량/경쟁사노출/키워드클러스터) 각각을 별도 async 컴포넌트로 쪼개 `<Suspense>`로 감싸서, "메인" 탭(Notion 읽기 2번뿐이라 원래 빠름)이 이 탭의 가장 느린 패널에 발목 잡히지 않고 즉시 스트리밍되게 함. (2) `openApiClient.ts`의 `searchBlog`/`searchCafe`를 React `cache()`로 요청 단위 메모이제이션해서, 언급량·경쟁사노출·키워드클러스터 패널이 겹치는 키워드에 대해 똑같은 기본 정렬(sim) 검색을 각자 다시 던지지 않게 함(예전엔 키워드당 최대 3번 중복 호출됨). 새 패널을 이 탭에 추가할 때도 이 두 패턴(Suspense 분리 + 겹치는 검색어는 cache()로 재사용)을 유지할 것 — 하나라도 빠지면 규모가 큰 세션에서 다시 느려짐.

### 10.2 인증 — 없음, 완전 개방 (2026-07 Supabase/OAuth 전체 삭제됨)

- 원래 네이버 소셜 로그인 + Supabase Auth + 업체 등록 구조였으나, 로그인·업체 등록·Supabase 자체를 전부 삭제하고 Notion 기반 즉석 조회로 재설계했다. `@supabase/*` 패키지, `supabase/migrations/`, `src/lib/supabase/`, `src/lib/auth/`, 관련 API 라우트/컴포넌트 전부 삭제됨 — 되살리지 말 것, 필요해지면 완전히 새로 설계할 것.
- 소유권 개념이 없다는 원칙은 유지: 결과 URL을 아는 사람은 누구나 볼 수 있음 (개인 도구의 `/result/[sessionId]`와 동일한 수준의 공개성).

### 10.3 패널

| 패널 | 데이터 소스 | 비고 |
|---|---|---|
| 블로그 지수 (메인 탭) | 아래 콘텐츠 진단 지표 종합 | 10점 만점, `RADAR_AXES` 지표 평균 (`src/lib/dashboard/contentDiagnostics.ts`) |
| 키워드 검색량 | 네이버 검색광고 API | + 총·월간 블로그 발행량/포화도 (`src/lib/naver/blogPublishStats.ts`, 키워드당 3시간 TTL 캐시 — 같은 키워드가 여러 검색에 겹칠 때 네이버를 재호출하지 않도록) |
| 블로그·카페 언급량 | 네이버 오픈API 검색 | |
| 경쟁업체 블로그 노출 순위 | 네이버 오픈API 블로그검색 + `findExposureRank`(`src/lib/dashboard/exposure.ts`) | |
| 키워드 클러스터 & 콘텐츠 전략 | 네이버 검색광고 API (마인드맵) | 규칙 기반 제목/태그 추천 (AI 아님). 연관 키워드가 3개 이하면 시드+수식어 조합으로 추가 조회해 보강 |
| 키워드 검색량 트렌드 배지 | 네이버 데이터랩 검색어트렌드 | 키워드 검색량 패널의 상위 `MAX_TREND_BADGE_KEYWORDS`(10)개까지, 개인 도구와 동일한 `TrendDirectionBadge` 재사용 |

**콘텐츠 진단 지표(`src/lib/dashboard/contentDiagnostics.ts`의 `RADAR_AXES`)**: 콘텐츠량 / 키워드 커버리지 / 고검색량 공략도 / 저경쟁 공략도 / 평균 노출순위 / 콘텐츠 최신성 / **사용자 반응**(최근 게시물 댓글수 기반, `src/lib/naver/blogEngagementScraper.ts`) — 배열 하나로 관리되므로 축을 추가/삭제할 때 이 배열만 건드리면 컴포짓 점수·갭 메시지·화면 그리드가 자동으로 따라감. 로컬(지역검색) 노출 패널은 2026-07 재설계 시 입력 폼에서 업체명/로컬 경쟁사 필드가 빠지면서 함께 제외됨 — 필요해지면 입력 폼부터 다시 설계할 것. 데이터랩 쇼핑인사이트 승인 후 붙일 자리가 없어진 옛 "데이터랩 트렌드" 플레이스홀더(`DatalabTrendPanel.tsx`)는 삭제함 — 쇼핑인사이트는 홈페이지 카테고리 패널 쪽으로 옮겨감(아래).

**임베드 배지** (2026-07 추가, "메인" 탭 하단 `EmbedBadgeCard.tsx`): 소상공인이 자기 블로그에 붙일 수 있는 `<img>` 배지 코드를 제공 — 배지를 클릭하면 이 세션의 `/dashboard/[sessionId]`로 연결되는 백링크이자 재유입 경로. 배지 이미지 자체는 `GET /api/badge/[sessionId]`가 `next/og`의 `ImageResponse`로 즉석 렌더링(320×88, 종합점수만 표시). 이 라우트는 **다른 사람 블로그에 계속 박제되어 매 방문자마다 호출**되므로, `getBlogScoreSessionById`/`getRecordsForBlogScoreSession` 조회 결과를 세션당 24시간 TTL 캐시(`createTtlCache`)에 담아 재요청마다 Notion을 다시 때리지 않게 함 — 어차피 점수는 세션 생성 시점에 고정되고 다시 안 바뀌므로(섹션 10.1) 긴 TTL이 안전함.

### 10.3.1 데이터랩 확장 (검색어트렌드 방향성 + 연령·성별·기기 + 쇼핑인사이트)

**2026-07, 데이터랩 쇼핑인사이트 승인 완료**(`npm run test:datalab`으로 실측 확인) — 더 이상 "승인 대기 중"이 아님. 검색어트렌드(`/v1/datalab/search`)는 원래부터 별도 승인 없이 쓸 수 있었음.

- **트렌드 방향성 배지** (`src/lib/naver/trendDirection.ts`의 `computeTrendDirection`, `src/components/TrendDirectionBadge.tsx`) — 최근 3개월 구간을 전반부/후반부로 나눠 평균 비율을 비교(±10% 미만은 "보합"). 개인 도구(`/result`, 시드 키워드만)와 블로그지수(`KeywordVolumePanel`, 상위 10개까지) 양쪽에서 재사용. 백엔드는 `POST /api/trend-badge`(키워드 목록만 받음, 세션 타입에 안 묶임).
- **"이 키워드는 누가 찾을까?" 연령·성별·기기 패널** (`src/components/search/KeywordAudiencePanel.tsx`, `POST /api/keyword-audience`) — **중요**: 검색어트렌드 API는 `device`/`gender`/`ages` 필터를 걸어도 그 결과가 다시 자기 구간 안에서 0~100으로 재정규화됨(실측 확인 — 필터를 걸어도 최고점이 그대로 100으로 나옴). 그래서 "여성이 남성보다 검색을 더 많이 한다" 같은 **크기 비교는 근거가 없고**, 그룹별 방향성(상승/보합/하락)만 의미가 있음 — 반드시 이 원칙을 유지할 것, 크기 비교 UI를 추가하지 말 것. 연령대는 원본 코드가 1~11(0~12세부터 60세~까지 세분화)이라 너무 잘게 쪼개져 있어서, 코드 2개씩 묶어 자연스러운 "10대/20대/.../60대 이상" 6구간으로 재구성함(`src/lib/naver/audienceGroups.ts`) — 코드를 배열로 여러 개 넘기면 그 구간들의 합집합 결과 하나가 옴(실측 확인, 구간별로 쪼개서 안 옴).
- **홈페이지 카테고리 패널의 쇼핑 관심도** (`src/lib/naver/datalabCategories.ts`의 `CATEGORY_CID_MAP`, `src/lib/naver/categoryShoppingTrend.ts`) — 쇼핑인사이트는 모든 호출에 카테고리 ID(CID)가 필수인데 네이버가 임의 키워드→카테고리 매칭 API를 안 줘서, 홈페이지 기존 8개 카테고리(`categoryTrends.ts`) 중 **실측으로 CID를 검증한 패션/뷰티/헬스·운동/여행 4개에만** 적용함. 외식·맛집/카페·디저트/교육은 애초에 소매 상품 카테고리가 아니라 대응 CID가 없고, 반려동물은 후보 CID들을 실측 시도했으나 데이터가 안 나와 확정 못함 — **새 카테고리를 이 맵에 추가하려면 반드시 실제 API 응답으로 CID를 먼저 검증할 것, 추측 금지**. 매핑 없는 카테고리는 그 섹션 자체를 조용히 숨김(빈 상태 문구도 안 씀).
- **공유 스로틀** — `datalabSearchClient.ts`·`datalabClient.ts`가 기존엔 `openApiClient.ts`의 스로틀을 안 거치고 각자 fetch했는데, 셋 다 같은 `NAVER_OPENAPI_CLIENT_ID/SECRET`을 쓰는 만큼 네이버 쪽 쿼터가 같은 버킷일 가능성이 있어 `src/lib/naver/throttle.ts`(신규)로 통합함. 새 데이터랩/오픈API 호출을 추가할 때 이 공유 스로틀을 거칠 것.

- **결과 이미지 저장**: "메인 (블로그지수)" 탭에 "이미지로 저장" 버튼(`src/components/dashboard/ExportableImage.tsx`) — `html-to-image`로 PNG 다운로드. `html2canvas`가 아니라 이걸 쓴 이유는 CSS를 직접 재구현하는 대신 실제 브라우저 렌더링을 그대로 캡처해서 이 프로젝트의 Tailwind v4 스타일(oklch 등)에 더 안전하기 때문. 카카오톡 공유 용도.
- 조회수/방문자수는 네이버 검색 API에 필드 자체가 없고, 블로그 통계(체류시간 등)는 소유자 로그인 전용 비공개 데이터라 API로도 스크래핑으로도 가져올 수 없음 — **요청받아도 만들어내지 말 것** (섹션 10.4 참고)
- `src/lib/naver/throttle.ts`의 `throttle()`이 오픈API 검색(`openApiClient.ts`)과 데이터랩 검색어트렌드·쇼핑인사이트(`datalabSearchClient.ts`/`datalabClient.ts`) 호출 전부를 공유 스로틀(최소 1초 간격)로 감쌈 — 새 오픈API/데이터랩 호출을 추가할 때 이 헬퍼를 거치지 않으면 429 레이트리밋에 바로 걸림. 이 스로틀은 인메모리 변수라 **상주형 서버 전제** (섹션 11 참고)
- 패널 하나가 실패해도 나머지가 죽지 않도록 `src/app/dashboard/[sessionId]/page.tsx`의 `settle()` 헬퍼로 각 패널을 개별 격리해서 fetch

### 10.4 비공식 스크래핑 (사용자 승인된 예외)

네이버 공식 API가 없는 데이터를 다룰 때 이 프로젝트의 기본 원칙은 "공식 API만 사용"이지만, 아래 두 가지는 사용자와 트레이드오프를 논의한 뒤 명시적으로 승인받은 예외임 — 다른 데이터에 함부로 이 예외를 확장하지 말 것.

- `src/lib/naver/blogProfileScraper.ts`: m.blog.naver.com의 `window.__INITIAL_STATE__`에서 카테고리/이웃수/방문자수/포스팅수 추출.
- `src/lib/naver/blogEngagementScraper.ts`: rss.blog.naver.com에서 최근 게시물 5개 링크를 얻고, 각 게시물 페이지에 escape되어 박혀 있는 `commentCount`를 정규식으로 추출해 평균 냄. 태그(`fetchPostTags`)도 같은 파일에서 게시물 페이지 본문에 박혀 있는 `tagNames` 필드를 정규식으로 추출. **공감(좋아요) 수는 로그아웃 상태에서 접근 가능한 어떤 페이지에도 실제 값이 없어서(기능 켜짐 여부만 있고 숫자가 없음) 구현하지 않았음** — 만들면 가짜 수치가 됨.
- 방문자 체류시간·제3자 서비스의 "블로거랭킹"은 네이버 소유자 로그인 전용 비공개 데이터이거나 제3자가 자체 계산한 값이라 어떤 방식(크롤링 포함)으로도 얻을 수 없음 — 규칙을 우회해도 존재하지 않는 데이터라 지어낼 수밖에 없음. 요청받아도 구현하지 말 것.
- 둘 다 도메인 기준 **6시간 TTL 인메모리 캐시**(`src/lib/utils/ttlCache.ts`)를 적용 — 동일 도메인 반복 조회 시 네이버로 나가는 실제 요청을 줄여 지연시간과 IP 차단 리스크를 함께 낮춤. 실패(null)는 캐싱하지 않음(일시적 오류가 TTL 내내 "비공개"로 얼어붙지 않도록). **이 캐시는 인메모리라 상주형 서버 전제** — 서버리스로 옮기면 Redis 등 외부 저장소로 바꿔야 함 (섹션 11 참고).

### 10.5 검색 진행 표시 (SSE)

- `/api/search`, `/api/blog-score`는 일반 JSON이 아니라 `text/event-stream`으로 진행 상태를 스트리밍함 (`src/lib/utils/sse.ts` + 클라이언트 `readSseStream.ts`). 네이버 오픈API 공유 스로틀(초당 1회) 때문에 키워드/경쟁사가 많으면 검색이 수십 초씩 걸릴 수 있어서, "○○ 확인 중..." 같은 실시간 상태로 "버튼이 안 눌린다"는 오해를 막기 위함. 새로 느린 검색 폼을 만들 때도 이 패턴을 따를 것.

### 10.6 스타일

- `design-system.md` 기준 ezzsearch 브랜드(coral/amber, Pretendard, 라이트 모드 전용 — 다크모드 없음)를 `/`, `/dashboard` 양쪽에 동일 적용. 새 UI를 추가할 때 토큰을 새로 발명하지 말고 기존 `--chart-*`/브랜드 CSS 변수를 재사용할 것

## 11. 배포

- **서버리스 부적합, 상주형 서버로 결정함 (2026-07, 사용자와 논의)** — 이 앱은 네이버 오픈API 공유 스로틀(`openApiClient.ts`)과 스크래핑 결과 캐시(`ttlCache.ts`)를 인메모리 변수로 구현해서, Node 프로세스가 하나 계속 떠 있어야 "전체 방문자가 공유"라는 설계 의도가 실제로 성립한다. Vercel처럼 요청마다 다른 인스턴스가 뜰 수 있는 서버리스 환경에서는 이 공유가 깨지고, `/api/search`·`/api/blog-score`의 SSE 스트리밍도 서버리스 함수 실행시간 제한에 걸려 중간에 끊길 수 있다. VPS/Railway/Render/Fly.io 등 Node 프로세스가 계속 떠 있는 플랫폼을 쓸 것. **`src/instrumentation.ts`의 백그라운드 잡 2개**(검색량 급상승 스냅샷 — 섹션 6.3, 12시간 주기 / 뉴스레터 발송 — 섹션 6.4, 7일 주기)도 서버가 계속 떠 있어야 의미가 있음 — 서버리스로 옮기면 Railway Cron 등 외부 스케줄러로 교체해야 함.
- **Docker로 배포** — `Dockerfile`(멀티스테이지, `next.config.ts`의 `output: "standalone"` 사용) + `.dockerignore` 준비돼 있음. 로컬 검증: `docker build -t easyserch .` → `docker run -p 3000:3000 --env-file .env.local easyserch`.
- **환경변수** — `.env.example` 참고, 실제 값은 `.env.local`(gitignore됨)에. 필수: `NAVER_API_KEY`/`NAVER_SECRET_KEY`/`NAVER_CUSTOMER_ID`(검색광고), `NAVER_OPENAPI_CLIENT_ID`/`NAVER_OPENAPI_CLIENT_SECRET`(오픈API), `NOTION_TOKEN`+DB ID 8개(세션/키워드결과/블로그지수세션/블로그지수결과/문의/`NOTION_KEYWORD_SNAPSHOTS_DB_ID`/`NOTION_VISITS_DB_ID`/`NOTION_SUBSCRIBERS_DB_ID`), `RESEND_API_KEY`+`CONTACT_EMAIL_TO`(문의하기, 섹션 12.3 — 뉴스레터 발송도 같은 `RESEND_API_KEY` 재사용, 섹션 6.4), `ADMIN_PASSWORD`(관리자 로그인, 섹션 12.2). `NOTION_PARENT_PAGE_ID`는 `scripts/setup-notion*.ts` 최초 1회 실행 때만 필요하고 런타임에는 불필요. **`.env.local.example` 같은 별도 예시 파일을 새로 만들지 말 것** — 예전에 낡은 사본이 실수로 방치돼 삭제된 적 있음(섹션 10.2에서 삭제한 변수들이 그 파일엔 여전히 남아 있었음), `.env.example` 하나만 유지.
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
- 통계 카드 4개(오늘 키워드 검색/방문자/문의 메일/블로그지수 확인, `src/lib/notion/{sessions,visits,inquiries,blogScoreSessions}.ts`의 `count*Today()` 함수들) + 최근 7일 검색 키워드 카드 로그(`getSessionsInRange(7)`, `WeeklySearchLogCards.tsx`) — 예전의 "최근 50건 리스트"(`RecentSessionsList.tsx`, `getRecentSessions()`)는 이 7일 카드 로그와 목적이 겹쳐서 삭제하고 대체함. 블로그지수 세션은 여기 안 뜸(별도 관리 화면 없음).
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
- **JSON-LD**: 루트 레이아웃에 `WebApplication` 스키마, `/guide/[slug]`마다 `Article` 스키마(섹션 12.1). 둘 다 `<script type="application/ld+json" dangerouslySetInnerHTML>`로 직접 주입 — 별도 라이브러리 없음.
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
| `lib/naver/`, `lib/notion/`, `lib/utils/` | 공유 | 네이버 API 클라이언트 / Notion 클라이언트+스키마 / 범용 유틸 — 두 제품 이상이 함께 쓰는 것 확인 후에만 여기 둘 것 |
| `components/` 최상위, `lib/constants.ts` | 공유 | `SiteHeader`/`Reveal`/`PainPointPromo`/`AmbientParticles`/`SearchProgressModal`/`ContactForm`/`MobileStickyCta`/`MobileNavMenu`/`ScrollProgressBar`처럼 두 제품 이상에서 쓰는 것 |
| `src/app/**` | 라우팅 | **절대 이 컨벤션으로 옮기지 않음** — 파일 위치 자체가 Next.js 라우팅 규칙 |

새 파일이 특정 기능에서만 쓰이는지 애매하면 `grep`으로 실제 importer를 확인한 뒤 폴더를 정하고(감으로 정하지 말 것), 파일 1개짜리 폴더(`lib/googleTrends/`, `lib/guide/`, `lib/scheduler/`, `lib/search/`)라도 나중에 같은 영역 파일이 늘어날 걸 감안해 미리 분리해두는 쪽을 기본값으로 삼음.

## 15. 알아둘 것 (자주 재발하는 실수)

- **날짜 표시는 항상 `formatKstDateTime()`(`src/lib/utils/formatDate.ts`) 사용, `new Date(x).toLocaleString("ko-KR")` 직접 쓰지 말 것.** locale은 표기 형식만 정하고 타임존은 안 정하기 때문에, 서버가 UTC로 도는 배포 환경(Railway 기본값)에서는 실제 한국 시간보다 9시간 어긋나게 표시됨 — 실제로 이 버그가 있었고(`/admin` 최근 검색 시간이 안 맞는다는 리포트) 사이트 전체 8곳에서 같은 실수가 반복되고 있었음.
- **네이버 검색광고 `hintKeywords` 파라미터는 공백이 섞이면 400 에러**(실측 확인, 섹션 6.3). 여러 단어로 된 후보 키워드를 조회할 땐 공백을 제거하고 보낼 것.
- **`src/lib/naver/throttle.ts`의 공유 스로틀(최소 1초 간격, 오픈API+데이터랩 공용)은 병렬화로 못 줄임** — 새로 느린 검색 기능을 만들 때 이 제약을 우회하려 하지 말고, 대신 반복 조회되는 키워드에 TTL 캐시를 씌우는 쪽으로 최적화할 것(`blogPublishStats.ts`의 3시간 캐시가 그 예).
