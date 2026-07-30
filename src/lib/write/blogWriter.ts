import Anthropic from "@anthropic-ai/sdk";
import { getCategoryRuleText, type BlogCategory } from "./blogRules";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `당신은 네이버 블로그에 익숙한 한국어 블로그 작가입니다. 사용자가 올린 사진들과 요청사항을
참고해서, 네이버 블로그 에디터에 바로 붙여넣을 수 있는 완성된 글을 작성하세요.

규칙:
- 친근하고 자연스러운 존댓말 블로그 톤으로 씁니다 (딱딱한 설명문 금지).
- 본문 중 사진을 넣으면 좋을 위치마다 정확히 "[사진N]" 형태로 표시하세요 (N은 1부터
  시작하는 업로드 순서). 실제 이미지 태그나 마크다운 이미지 문법은 쓰지 마세요 — 사용자가
  네이버 에디터에서 직접 사진을 끼워 넣을 자리 표시일 뿐입니다.
- 업로드된 사진 중 썸네일(대표 이미지)로 가장 적합한 것 하나를 고르고 이유를 짧게 설명하세요.
- 아래에 이 글의 유형("선택된 글 유형")에 대한 작성 규칙이 첨부되어 있습니다. 제목 형식,
  글 구조, 문장 톤, 이미지 배치, (해당되는 경우) 광고·협찬 표기 의무까지 최대한 그대로
  반영하세요. 광고·협찬 표기가 요구되는 유형이면 그 문구를 제목 또는 본문 첫 문장에
  실제로 포함시키세요 — 안내만 하고 빠뜨리면 안 됩니다.
- 네이버 블로그 태그 입력창에 바로 붙여넣을 수 있는 한국어 해시태그 스타일 추천 태그를
  5~8개 뽑아 "tags" 배열에 담으세요. "#" 기호는 붙이지 마세요.
- 사용자가 올린 사진 외에 추가로 곁들이면 좋을 무료 스톡 이미지를 찾기 위한 검색어를
  "stockImageQueries" 배열에 3~4개 담으세요. 이 검색어는 반드시 영어 키워드 구문으로
  작성하세요(스톡 이미지 검색 서비스가 영어 태그 위주라서). 업로드된 사진을 대체하는
  것이 아니라 보완하는 이미지를 위한 검색어입니다.
- 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트를 앞뒤에 붙이지 마세요.

{
  "title": "블로그 글 제목",
  "body": "본문 전체 (문단 구분은 줄바꿈 두 번, [사진N] 표시 포함)",
  "recommendedThumbnail": 1,
  "thumbnailReason": "왜 이 사진을 추천하는지 한 문장",
  "tags": ["태그1", "태그2"],
  "stockImageQueries": ["english keyword phrase", "another phrase"]
}`;

export interface BlogWriterImage {
  base64: string; // no "data:image/...;base64," prefix
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export interface BlogWriterResult {
  title: string;
  body: string;
  recommendedThumbnail: number;
  thumbnailReason: string;
  tags: string[];
  stockImageQueries: string[];
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

  const title = typeof parsed.title === "string" ? parsed.title : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";
  if (!title || !body) throw new Error("생성된 글에 제목 또는 본문이 없습니다.");

  const rawThumbnail = Number(parsed.recommendedThumbnail);
  const recommendedThumbnail =
    Number.isInteger(rawThumbnail) && rawThumbnail >= 1 && rawThumbnail <= imageCount
      ? rawThumbnail
      : 1;

  const thumbnailReason = typeof parsed.thumbnailReason === "string" ? parsed.thumbnailReason : "";

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t: unknown): t is string => typeof t === "string").slice(0, 8)
    : [];
  const stockImageQueries = Array.isArray(parsed.stockImageQueries)
    ? parsed.stockImageQueries.filter((q: unknown): q is string => typeof q === "string").slice(0, 4)
    : [];

  return { title, body, recommendedThumbnail, thumbnailReason, tags, stockImageQueries };
}

export async function generateBlogPost(
  images: BlogWriterImage[],
  prompt: string,
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
        content: [...imageBlocks, { type: "text", text: prompt }],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude 응답에서 텍스트를 찾을 수 없습니다.");
  }

  return parseResult(textBlock.text, images.length);
}
