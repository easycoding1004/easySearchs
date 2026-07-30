# AI 블로그 글쓰기 기능 구현 가이드

이지서치(ezzsearch)에 새로 추가하는 "사진+프롬프트 → 완성된 블로그 글 초안" 기능을 구현할 때 참고하는 스킬. 배경/설계 결정은 `CLAUDE.md` 섹션 16을 먼저 읽을 것 — 이 파일은 그 결정을 실제 코드로 옮길 때 필요한 구체적인 레시피(프롬프트 템플릿, API 호출 구조, 체크리스트)를 담는다.

## 이 기능이 하는 일 (한 줄 요약)

사용자가 사진 여러 장 + "어떤 글을 원하는지" 프롬프트를 올리면, Claude API가 네이버 블로그에 바로 붙여넣을 수 있는 제목+본문(+사진 삽입 위치 안내 +추천 썸네일)을 생성해서 화면에 보여준다. 저장하지 않는다 — 복사해서 쓰는 1회성 결과물.

## 남용/비용 방지 — 구현 완료

과금되는 Claude API를 로그인 없는 사이트에 무방비로 열어두면 안 된다는 문제를 이렇게 풀었다 (CLAUDE.md §16 참고):

- [x] 정식 계정 로그인(이메일+비밀번호, 이메일 인증 필수) — `src/lib/notion/users.ts` + `src/lib/write/auth.ts` + `/api/auth/*`
- [x] 계정당 하루 1회 제한 — `hasUsedToday()`/`markUsedToday()`, Claude 호출이 실제 성공했을 때만 소진
- [x] 이미지 개수(최대 5장)·용량(장당 5MB)·프롬프트 글자수(500자) 서버 강제 — `src/app/api/write/route.ts`
- [ ] 봇 방지(Turnstile 등)는 아직 없음 — 계정+이메일 인증만으로 충분하다고 판단했으나, 실제로 가짜 이메일 대량 가입이 문제가 되면 추가 검토할 것

## 아키텍처

```
[사용자] → 사진 업로드(브라우저 로컬 미리보기만, 서버 저장 없음) + 프롬프트 입력
                │
                ▼
        POST /api/write (multipart/form-data)
                │  이미지를 base64로 변환해 Claude API 요청에 담아 바로 전송
                │  (디스크/DB에 파일로 남기지 않음 — CLAUDE.md §16의 "영구 저장 안 함" 결정)
                ▼
        Anthropic Messages API (vision 지원 모델)
                │
                ▼
        생성된 제목/본문/사진 배치 안내/추천 썸네일을 JSON으로 파싱
                │
                ▼
   [프론트: 결과 화면 — 복사 버튼, 업로드한 사진 미리보기 재사용]
```

세션/결과 URL 없음 — `/result/[sessionId]`나 `/dashboard/[sessionId]` 같은 패턴을 이 기능에 그대로 가져오지 말 것. 이 기능은 요청-응답이 끝나면 끝.

## Claude API 호출 레시피

`@anthropic-ai/sdk` 신규 의존성 필요 (`npm install @anthropic-ai/sdk`). `ANTHROPIC_API_KEY`는 `.env.local`에 추가하고 `.env.example`에도 반영할 것(CLAUDE.md §11의 "`.env.local.example` 같은 별도 파일 새로 만들지 말 것" 원칙 그대로 유지 — `.env.example` 하나만).

### 메시지 구성

이미지는 `image` content block, 프롬프트는 `text` content block으로 하나의 user 메시지에 함께 담는다:

```ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const imageBlocks = uploadedImages.map((img) => ({
  type: "image" as const,
  source: {
    type: "base64" as const,
    media_type: img.mimeType, // "image/jpeg" | "image/png" | "image/webp" 등, 업로드 시 검증
    data: img.base64, // 데이터 URL의 "data:image/...;base64," 접두어는 제거하고 순수 base64만
  },
}));

const message = await anthropic.messages.create({
  model: "claude-sonnet-5", // 실제 구현에 쓴 모델(`src/lib/write/blogWriter.ts`) — 더 최신 모델이 나오면 교체 검토
  max_tokens: 4096,
  system: BLOG_WRITER_SYSTEM_PROMPT,
  messages: [
    {
      role: "user",
      content: [...imageBlocks, { type: "text", text: userPrompt }],
    },
  ],
});
```

### 시스템 프롬프트 초안

실제 톤/형식은 UI 프로토타입을 보면서 다듬어야 하지만, 출발점:

```
당신은 네이버 블로그에 익숙한 한국어 블로그 작가입니다. 사용자가 올린 사진들과 요청사항을
참고해서, 네이버 블로그 에디터에 바로 붙여넣을 수 있는 완성된 글을 작성하세요.

규칙:
- 친근하고 자연스러운 존댓말 블로그 톤으로 씁니다 (딱딱한 설명문 금지).
- 본문 중 사진을 넣으면 좋을 위치마다 정확히 "[사진N]" 형태로 표시하세요 (N은 1부터
  시작하는 업로드 순서). 실제 이미지 태그나 마크다운 이미지 문법은 쓰지 마세요 — 사용자가
  네이버 에디터에서 직접 사진을 끼워 넣을 자리 표시일 뿐입니다.
- 업로드된 사진 중 썸네일(대표 이미지)로 가장 적합한 것 하나를 고르고 이유를 짧게 설명하세요.
- 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트를 앞뒤에 붙이지 마세요.

{
  "title": "블로그 글 제목",
  "body": "본문 전체 (문단 구분은 줄바꿈 두 번, [사진N] 표시 포함)",
  "recommendedThumbnail": 1,
  "thumbnailReason": "왜 이 사진을 추천하는지 한 문장"
}
```

### 글 유형별 규칙 첨부 (2026-07 추가)

실제 구현은 여기에 유형별 규칙을 이어붙인다. `src/lib/write/blogRules.ts`(서버 전용, `fs`로 `new_blog/*.md`를 런타임에 읽음)의 `getCategoryRuleText(category)`가 `new_blog/블로그글쓰기규칙_개요.md`(공통 규칙) + 선택된 유형의 `.md` 파일을 합쳐서 돌려주고, `blogWriter.ts`가 이걸 `SYSTEM_PROMPT` 뒤에 이어붙여 `anthropic.messages.create`의 `system`으로 보낸다. 카테고리 목록 자체(`BLOG_CATEGORIES`)는 `fs` 의존이 없는 `src/lib/write/blogCategories.ts`에 따로 있음 — 클라이언트 컴포넌트(`BlogWriterForm.tsx`)는 반드시 이쪽만 import할 것, `blogRules.ts`를 client 쪽에서 import하면 `fs`가 브라우저 번들에 끌려들어가 빌드가 깨진다.

**유형은 사용자가 고르지 않고 자동 분류된다** (2026-07 추가) — `src/lib/write/classifyCategory.ts`의 `classifyPromptCategory(prompt)`가 본 생성 호출 전에 `claude-haiku-4-5`로 프롬프트를 강제 tool-call 분류(`tool_choice: {type:"tool", name:"classify_blog_category"}`, enum 제약된 `category` 파라미터 하나)한다. 텍스트 JSON 파싱이 아니라 강제 tool call을 쓴 이유는 5지선다 분류 하나에는 그게 훨씬 안전해서(프리텍스트 섞임 등의 실패 모드가 구조적으로 없어짐). 분류가 실패하면(Haiku 오류 등) `정보노하우형`으로 조용히 폴백하고 절대 throw하지 않는다 — 여기서 실패해서 하루 1회뿐인 본 생성(Sonnet 5) 시도까지 날리면 안 되기 때문. `/api/write/route.ts`에서 호출 순서는 반드시 `classifyPromptCategory` → `generateBlogPost`(분류 결과가 어떤 규칙 파일을 넣을지 결정하므로).

**네이버 블로그에 직접 자동 발행하지 않는다 — 반자동이 최종 결정이다.** 처음에는 "프롬프트만 넣으면 네이버 블로그에 자동 발행"이 요청됐으나, 조사 결과 네이버 블로그 글쓰기 오픈API(`writePost.json`)는 광고 스팸 남용 때문에 **2020-05-06부로 완전히 폐지**되어 지금은 신청할 수 있는 API 자체가 없다(뉴스 확인, 개인/사업자 무관). 그래서 서버가 대신 발행하는 방식은 아예 불가능하고, 사용자와 다시 논의해 결과 화면에 제목/본문/추천 태그/추천 스톡이미지를 다 만들어 보여주고 "네이버 블로그 글쓰기 열기" 버튼(`https://blog.naver.com/{아이디}?Redirect=Write&`)으로 최종 등록은 사용자가 직접 하는 흐름으로 확정했다. 이걸 다시 완전 자동화하려는 요청이 오면 이 폐지 사실부터 다시 확인하고 CLAUDE.md §16을 참고할 것 — 남은 유일한 경로는 브라우저 확장/북마클릿으로 사용자 자신의 로그인 세션에서 에디터를 채우는 것뿐이고, 이건 별도 프로젝트급 작업이다.

**추천 태그**: `blogWriter.ts`의 JSON 응답 스키마에 `tags: string[]`(한국어 해시태그 5~8개, `#` 없이) 추가됨. 네이버 공식 API에 애초에 태그 파라미터가 없었으므로 자동 삽입 대상이 아니라 복사·붙여넣기 UI(`BlogWriterForm.tsx`의 "태그 복사" 버튼)로만 노출.

**추천 스톡 이미지**: `src/lib/write/imageSearch.ts`의 `searchStockImages(queries)`가 Pixabay 무료 이미지 검색(`GET https://pixabay.com/api/`, `PIXABAY_API_KEY` env var)을 호출. 검색어는 `blogWriter.ts`가 응답에 담는 `stockImageQueries: string[]`(반드시 영어 — Pixabay 태그 코퍼스가 영어 위주라서 시스템 프롬프트가 영어로 뽑도록 지시함). **`searchStockImages`는 절대 throw하지 않는 계약** — `PIXABAY_API_KEY` 미설정이거나 개별 쿼리가 실패하면 그 쿼리는 그냥 빈 배열, 전체 실패해도 `[]`만 반환. `/api/write` route가 이 결과를 응답에 `stockImages`로 얹지만, 실패해도 title/body/tags 등 나머지는 정상 반환돼야 한다(부가 기능이 본 기능을 막으면 안 됨 — CLAUDE.md 섹션 10.3의 `settle()`과 같은 원칙).

**네이버 블로그 아이디**: Naver OAuth 프로필 응답에는 `blog.naver.com/{아이디}`에 쓰이는 슬러그가 없다(오픈API의 `id`는 앱별 해시일 뿐 블로그 URL과 무관 — 실제로 이것 때문에 계정에 한 번 입력받아 저장하는 방식으로 갔다). `USER_PROPS.naverBlogId`(Notion 속성명 `네이버블로그ID`, `scripts/add-user-naver-blog-id-prop.ts`로 추가) + `setNaverBlogId()`(`src/lib/notion/users.ts`) + 저장 전용 라우트 `POST /api/write/naver-blog-id`. 이 라우트를 `/api/write`(하루 1회 제한 걸린 유료 호출)와 분리한 이유: 이 필드는 공짜고 여러 번 고칠 수 있어야 해서 일일 제한 로직과 섞으면 안 된다.

### 응답 파싱

Claude가 지시를 따르지 않고 JSON 앞뒤에 설명을 붙일 수 있으므로, 방어적으로 파싱할 것 — `content[0].text`에서 첫 `{`부터 마지막 `}`까지만 추출한 뒤 `JSON.parse`, 실패 시 사용자에게 "생성에 실패했어요, 다시 시도해주세요" 에러로 처리(이 프로젝트의 다른 API 라우트들과 같은 패턴 — 조용히 깨지지 않고 명확한 에러 메시지).

## 폴더 컨벤션

CLAUDE.md §14 기준: 이 기능은 개인 도구도 블로그지수도 아니므로 `lib/write/`, `components/write/` 같은 새 하위 폴더를 만들 것(단일 파일이라도 나중에 늘어날 걸 감안해 미리 분리 — 이미 `lib/googleTrends/`, `lib/guide/` 등이 이 패턴을 따르고 있음). `src/app/write/` 라우트는 파일 위치 자체가 라우팅 규칙이라 이 컨벤션 대상이 아님.

## 검증 방법 (이 프로젝트의 기존 관례)

- `npx tsc --noEmit -p .`, `npx eslint .` 클린 확인.
- `npm run build` 후 standalone 서버(`.env.local`/`public`/`.next/static`을 `.next/standalone/`에 복사, `node .next/standalone/server.js`)로 실제 이미지+프롬프트를 넣어 실제 API 응답을 받는지 확인 — mock 없이 실제 Claude API 호출까지 검증할 것.
- 남용 방지 장치(하루 호출 제한 등)가 실제로 N+1번째 요청을 막는지 직접 재현해서 확인.
