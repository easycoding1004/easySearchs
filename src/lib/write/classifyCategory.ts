import Anthropic from "@anthropic-ai/sdk";
import { BLOG_CATEGORIES, isBlogCategory, type BlogCategory } from "./blogCategories";
import { getErrorMessage } from "@/lib/utils/errors";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 128;
const DEFAULT_CATEGORY: BlogCategory = "정보노하우형";

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "classify_blog_category",
  description: "사용자의 요청을 아래 다섯 가지 네이버 블로그 글 유형 중 하나로 분류합니다.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: BLOG_CATEGORIES.map((c) => c.id),
        description: BLOG_CATEGORIES.map((c) => `${c.id} — ${c.label}: ${c.hint}`).join("\n"),
      },
    },
    required: ["category"],
  },
};

// 유형별 규칙 텍스트(getCategoryRuleText)를 시스템 프롬프트에 넣기 전에 먼저
// 유형을 정해야 하므로, 본 생성 호출보다 앞서 실행하는 저비용 분류 전용 호출.
// 분류가 실패해도(Haiku 오류 등) 기본 유형으로 폴백 — 하루 1회뿐인 본 생성
// 시도를 분류 단계 문제로 날리면 안 됨.
export async function classifyPromptCategory(prompt: string): Promise<BlogCategory> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing environment variable: ANTHROPIC_API_KEY");

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "tool", name: "classify_blog_category" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    const category = (toolUse?.input as { category?: unknown } | undefined)?.category;
    if (isBlogCategory(category)) return category;
  } catch (err) {
    console.error("[classifyPromptCategory] failed, using default:", getErrorMessage(err));
  }
  return DEFAULT_CATEGORY;
}
