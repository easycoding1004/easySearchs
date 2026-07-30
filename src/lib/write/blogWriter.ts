import Anthropic from "@anthropic-ai/sdk";
import { getCategoryRuleText, type BlogCategory } from "./blogRules";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `당신은 네이버 블로그에 익숙한 한국어 블로그 작가입니다. 사용자가 올린 사진(있다면)과
요청사항을 참고해서, 네이버 블로그 에디터에 바로 붙여넣을 수 있는 완성된 글을 작성하세요.
사진을 한 장도 올리지 않았을 수도 있습니다 — 그 경우 사진 없이도 프롬프트 내용만으로 충분히
완성된 글을 쓰세요(부족하다고 거부하거나 사진을 요구하지 마세요).

규칙:
- 친근하고 자연스러운 존댓말 블로그 톤으로 씁니다 (딱딱한 설명문 금지).
- **제목에는 "[광고]", "[협찬]", "#광고" 같은 표기를 절대 넣지 마세요.** 광고·협찬 표기가
  필요한 유형이면 본문 첫 줄에만 넣으세요(아래 유형별 규칙에 자세히 나와 있습니다).
- 본문 안에 소제목을 넣을 위치마다 그 줄 맨 앞에 "## "를 붙이세요 (예: "## 첫인상은 이랬어요").
  소제목 개수·주기는 아래 유형별 규칙(있다면)을 따르세요. 화면에 표시될 때 소제목은 자동으로
  꾸며지니(색·굵기·구분선) 소제목 문구 자체에 마크다운 기호를 더 넣을 필요는 없습니다 —
  다만 어울리면 이모지 하나 정도(예: "## ☕ 첫 방문 후기")는 자유롭게 넣어도 좋습니다.
- 항목을 나열할 때(정리·목차·단계별 설명·장단점 등)는 리스트 문법을 쓰세요: 순서 상관없는
  목록은 각 줄 맨 앞에 "- "를, 순서가 있는 목록은 "1. ", "2. "처럼 번호를 붙이세요. 목록의
  각 줄은 빈 줄 없이 바로 이어서 쓰세요(줄바꿈 한 번). 화면에서는 원문자(①②③)나 화살표
  기호로 자동 스타일링되니 목록 안에 직접 특수문자를 넣을 필요는 없습니다.
- 본문 중 강조하고 싶은 짧은 문구(핵심 정보·숫자·결론 등)는 "**문구**"처럼 별표 두 개로
  감싸세요. 문단마다 많아야 1~2곳 — 남발하면 오히려 안 읽힙니다.
- 본문 중 사용자가 올린 사진을 넣으면 좋을 위치마다 정확히 "[사진N: 짧은 캡션]" 형태로
  표시하세요 (N은 1부터 시작하는 업로드 순서, 캡션은 그 사진을 한 줄로 설명하는 문구 —
  반드시 넣으세요). 예: "[사진1: 카페 입구 전경]". **사용자가 사진을 한 장도 올리지
  않았다면 이 표시를 절대 쓰지 마세요.**
- 사용자가 올린 사진 외에 보완할 무료 스톡 사진이 있으면 좋을 위치마다 "[스톡이미지:
  짧은 캡션]" 표시를 넣으세요(번호 없이, 필요한 만큼 여러 번 사용 가능, 캡션 필수). 이
  검색어는 "stockImageQueries" 배열에 3~4개, 반드시 영어 키워드 구문으로 담으세요(스톡
  이미지 검색 서비스가 영어 태그 위주라서).
- 실제 사진이나 스톡 사진으로 대체하기 어려운 경우(제품 비교표, 데이터 시각화, 개념
  설명용 그래픽 등)에만 AI로 새로 생성한 이미지를 요청하세요 — 비용이 드는 기능이니
  꼭 필요한 것만 골라 쓰되, 글의 맥락상 여러 장이 실제로 필요하면(예: 제품을 3개
  비교하면서 각각 그래픽이 필요하거나, 여러 단계를 각각 그림으로 보여줘야 하는 경우)
  주저하지 말고 필요한 만큼(최대 5개까지) 요청하세요 — 무조건 적게 쓰는 것보다
  글에 실제로 도움이 되는지가 기준입니다. 본문에는 "[AI이미지N: 짧은 캡션]"(N은 1부터,
  캡션 필수) 표시를 넣고, 그 이미지를 그릴 상세한 프롬프트를 "aiImagePrompts" 배열에
  순서대로 담으세요. 구도·스타일 등 전반적인 설명은 영어로 써도 됩니다(이미지 생성
  모델이 영어 지시를 가장 잘 따릅니다). **하지만 이미지 안에 실제로 보이는 글자(제품명,
  가격, 항목 라벨, 숫자, 차트 제목 등)는 절대 영어로 옮기지 말고 한국어 그대로 큰따옴표로
  인용해서 넣고, 그 한글 텍스트를 그대로(번역하지 말고) 렌더링하라고 명확히 지시하세요**
  — 그렇지 않으면 한국어 블로그인데 이미지 속 글자만 영어로 나옵니다. 예: "A clean
  product comparison infographic. Render the following Korean text exactly as
  written, do not translate to English: title '제품 A vs 제품 B', row labels
  '가격', '용량', '평점'."
- 업로드된 사진이 1장 이상 있다면 그중 썸네일(대표 이미지)로 가장 적합한 것 하나를
  고르고("recommendedThumbnail"에 1부터 시작하는 사진 번호) 이유를 짧게 설명하세요. 사진이
  없다면 "recommendedThumbnail"은 0, "thumbnailReason"은 빈 문자열로 응답하세요.
- 아래에 이 글의 유형("선택된 글 유형")에 대한 작성 규칙이 첨부되어 있습니다. 제목 형식,
  글 구조, 문장 톤, 이미지 배치, (해당되는 경우) 광고·협찬 표기 의무까지 최대한 그대로
  반영하세요. 광고·협찬 표기가 요구되는 유형이면 그 문구를 실제로 본문 첫 줄에
  포함시키세요 — 안내만 하고 빠뜨리면 안 됩니다.
- 네이버 블로그 태그 입력창에 바로 붙여넣을 수 있는 한국어 해시태그 스타일 추천 태그를
  5~8개 뽑아 "tags" 배열에 담으세요. "#" 기호는 붙이지 마세요.
- 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트를 앞뒤에 붙이지 마세요.

{
  "title": "블로그 글 제목 (광고 표기 없이)",
  "body": "본문 전체 (문단 구분은 줄바꿈 두 번, ## 소제목, - 또는 1. 목록, **강조**, [사진N: 캡션]/[스톡이미지: 캡션]/[AI이미지N: 캡션] 표시 포함)",
  "recommendedThumbnail": 1,
  "thumbnailReason": "왜 이 사진을 추천하는지 한 문장 (사진 없으면 빈 문자열)",
  "tags": ["태그1", "태그2"],
  "stockImageQueries": ["english keyword phrase", "another phrase"],
  "aiImagePrompts": ["detailed prompt (English for style/composition, but any in-image text must be quoted Korean with an explicit 'do not translate' instruction)"]
}`;

export interface BlogWriterImage {
  base64: string; // no "data:image/...;base64," prefix
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export interface BlogWriterResult {
  title: string;
  body: string;
  recommendedThumbnail: number; // 0 = 추천 썸네일 없음(업로드된 사진이 없었음)
  thumbnailReason: string;
  tags: string[];
  stockImageQueries: string[];
  aiImagePrompts: string[];
}

// 사용자 요청(2026-07): 제목에 광고·협찬 표기가 남지 않게 해달라는 요청 —
// 시스템 프롬프트로 지시했지만 모델이 가끔 놓칠 수 있어 방어적으로 한 번 더
// 걷어냄. new_blog 규칙 문서들은 이제 표기를 본문 첫 줄에만 넣도록 바뀌었으니
// (섹션 1/4 참고) 제목에서 발견되면 순수하게 실수로 봐도 됨.
const AD_TAG_PATTERN = /^(\[(광고|협찬|AD|PR)\]\s*|#(광고|협찬)\s*)/i;

function stripAdTagFromTitle(title: string): string {
  return title.replace(AD_TAG_PATTERN, "").trim();
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("응답에서 JSON을 찾을 수 없습니다.");
  }
  return text.slice(start, end + 1);
}

function parseResult(text: string, imageCount: number): BlogWriterResult {
  const parsed = JSON.parse(extractJson(text));

  const rawTitle = typeof parsed.title === "string" ? parsed.title : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";
  if (!rawTitle || !body) throw new Error("생성된 글에 제목 또는 본문이 없습니다.");
  const title = stripAdTagFromTitle(rawTitle);

  const rawThumbnail = Number(parsed.recommendedThumbnail);
  const recommendedThumbnail =
    imageCount > 0 && Number.isInteger(rawThumbnail) && rawThumbnail >= 1 && rawThumbnail <= imageCount
      ? rawThumbnail
      : 0;

  const thumbnailReason =
    recommendedThumbnail > 0 && typeof parsed.thumbnailReason === "string" ? parsed.thumbnailReason : "";

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t: unknown): t is string => typeof t === "string").slice(0, 8)
    : [];
  const stockImageQueries = Array.isArray(parsed.stockImageQueries)
    ? parsed.stockImageQueries.filter((q: unknown): q is string => typeof q === "string").slice(0, 4)
    : [];
  // 서버 쪽 하드 캡 — 시스템 프롬프트가 "최대 5개"라고 안내하지만, 모델이 지시를
  // 안 지켜도 비용 폭주를 막는 최종 안전장치(사용자 요청으로 2026-07에 2→5로 상향).
  const aiImagePrompts = Array.isArray(parsed.aiImagePrompts)
    ? parsed.aiImagePrompts.filter((p: unknown): p is string => typeof p === "string").slice(0, 5)
    : [];

  return { title, body, recommendedThumbnail, thumbnailReason, tags, stockImageQueries, aiImagePrompts };
}

// generateBlogPost와 reviseBlogPost가 공유하는 실제 호출부 — 시스템 프롬프트
// 구성/파싱 로직은 완전히 같고, user 턴에 들어가는 텍스트(최초 프롬프트 vs
// "기존 글 + 수정 요청")만 다르므로 여기로 몰아둠.
async function callClaude(
  images: BlogWriterImage[],
  userText: string,
  category: BlogCategory
): Promise<BlogWriterResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing environment variable: ANTHROPIC_API_KEY");

  const anthropic = new Anthropic({ apiKey });

  const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mimeType, data: img.base64 },
  }));

  const systemPrompt = `${SYSTEM_PROMPT}\n\n## 선택된 글 유형: ${category}\n\n${getCategoryRuleText(category)}`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: userText }],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude 응답에서 텍스트를 찾을 수 없습니다.");
  }

  return parseResult(textBlock.text, images.length);
}

export async function generateBlogPost(
  images: BlogWriterImage[],
  prompt: string,
  category: BlogCategory
): Promise<BlogWriterResult> {
  return callClaude(images, prompt, category);
}

// 이미 생성된 글에 "제목을 더 짧게", "3번째 문단 빼줘" 같은 수정 요청을 반영해
// 다시 쓰게 함(2026-07 추가). 유형(category)은 최초 생성 때 정해진 걸 그대로
// 유지 — 재분류하지 않음(사용자가 유형을 바꿔달라고 한 게 아니므로). 사진도
// 다시 같이 보내는 이유: 수정 요청이 사진 배치·설명과 관련될 수도 있어서
// (예: "사진1 캡션을 더 자세히 써줘") 매번 새로 맥락을 줘야 함 — 이 API가
// 대화 상태를 유지하는 게 아니라 매 호출이 독립적인 단발 요청이기 때문.
export async function reviseBlogPost(
  images: BlogWriterImage[],
  previous: Pick<BlogWriterResult, "title" | "body" | "tags">,
  instruction: string,
  category: BlogCategory
): Promise<BlogWriterResult> {
  const userText = `기존에 작성한 글입니다.

제목: ${previous.title}

본문:
${previous.body}

태그: ${previous.tags.join(", ")}

사용자의 수정 요청: "${instruction}"

위 수정 요청만 반영해서 전체 글을 다시 작성하세요. 요청하지 않은 부분(사진·스톡·AI이미지
배치, 나머지 문단, 톤 등)은 원래 내용을 최대한 그대로 유지하세요. 응답은 처음 글쓰기
때와 똑같은 JSON 형식으로 하세요.`;

  return callClaude(images, userText, category);
}
