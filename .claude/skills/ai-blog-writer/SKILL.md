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

### 응답 파싱

Claude가 지시를 따르지 않고 JSON 앞뒤에 설명을 붙일 수 있으므로, 방어적으로 파싱할 것 — `content[0].text`에서 첫 `{`부터 마지막 `}`까지만 추출한 뒤 `JSON.parse`, 실패 시 사용자에게 "생성에 실패했어요, 다시 시도해주세요" 에러로 처리(이 프로젝트의 다른 API 라우트들과 같은 패턴 — 조용히 깨지지 않고 명확한 에러 메시지).

## 폴더 컨벤션

CLAUDE.md §14 기준: 이 기능은 개인 도구도 블로그지수도 아니므로 `lib/write/`, `components/write/` 같은 새 하위 폴더를 만들 것(단일 파일이라도 나중에 늘어날 걸 감안해 미리 분리 — 이미 `lib/googleTrends/`, `lib/guide/` 등이 이 패턴을 따르고 있음). `src/app/write/` 라우트는 파일 위치 자체가 라우팅 규칙이라 이 컨벤션 대상이 아님.

## 검증 방법 (이 프로젝트의 기존 관례)

- `npx tsc --noEmit -p .`, `npx eslint .` 클린 확인.
- `npm run build` 후 standalone 서버(`.env.local`/`public`/`.next/static`을 `.next/standalone/`에 복사, `node .next/standalone/server.js`)로 실제 이미지+프롬프트를 넣어 실제 API 응답을 받는지 확인 — mock 없이 실제 Claude API 호출까지 검증할 것.
- 남용 방지 장치(하루 호출 제한 등)가 실제로 N+1번째 요청을 막는지 직접 재현해서 확인.
