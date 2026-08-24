import Anthropic from "@anthropic-ai/sdk";
import { RADAR_AXES, type RadarScore, type GapMessage } from "./contentDiagnostics";

const MODEL = "claude-sonnet-5";
// 3~5문장짜리 짧은 요약이라 blogWriter.ts(8192)보다 훨씬 작게 잡음 — 비용을
// 최소화하면서도 잘리지 않을 만큼만.
const MAX_TOKENS = 700;

const SYSTEM_PROMPT = `당신은 소상공인 블로그 운영을 돕는 컨설턴트입니다. 아래 JSON으로 주어지는
블로그지수 데이터(이 서비스가 자체 산정한 지표이며 네이버 공식 지표가 아닙니다)만 근거로,
이 블로그 운영자에게 도움이 되는 짧은 인사이트 요약을 작성하세요.

규칙:
- 3~5문장, 친근한 존댓말로 씁니다.
- 주어진 숫자·데이터만 근거로 삼고, 없는 정보(조회수·방문자 추이 등 안 준 데이터)는 지어내지 마세요.
- 강점 1~2개와 약점 1~2개를 자연스럽게 짚고, 마지막에 구체적이고 실행 가능한 개선 제안을 1~2개
  포함하세요.
- 비교 블로그 데이터(competitors)가 있으면 자연스럽게 언급해도 좋지만, 없으면 비교 언급을
  하지 마세요.
- 순수 텍스트로만 응답하세요. 마크다운 기호(#, *, -)나 JSON 없이 줄글로만 쓰세요.`;

export interface InsightReportInput {
  domain: string;
  compositeScore: number;
  axisScores: { label: string; value: number }[];
  postCount: number | null;
  avgRecentComments: number | null;
  avgRecentReactions: number | null;
  avgRecentShares: number | null;
  category: string | null;
  topTerms: string[];
  keywords: string[];
  gaps: GapMessage[];
  competitorCount: number;
}

export function buildInsightReportInput(
  mine: RadarScore,
  compositeScoreValue: number,
  profile: { postCount: number | null; category: string | null } | null,
  avgRecentComments: number | null,
  avgRecentReactions: number | null,
  avgRecentShares: number | null,
  topTerms: { term: string; count: number }[],
  keywords: string[],
  gaps: GapMessage[],
  competitorCount: number
): InsightReportInput {
  return {
    domain: mine.domain,
    compositeScore: compositeScoreValue,
    // RADAR_AXES에서 뽑아 씀 — 2026-08 후속으로 "검색 상위노출"이 컴포짓
    // 점수에서 빠지면서 이 배열도 4개로 자동으로 줄어듦(하드코딩해뒀으면
    // Claude에게 더 이상 점수에 안 들어가는 값을 5번째 지표인 것처럼
    // 잘못 전달할 뻔함).
    axisScores: RADAR_AXES.map(({ key, label }) => ({ label, value: mine[key] })),
    postCount: profile?.postCount ?? null,
    avgRecentComments,
    avgRecentReactions,
    avgRecentShares,
    category: profile?.category ?? null,
    topTerms: topTerms.map((t) => t.term).slice(0, 8),
    keywords,
    gaps,
    competitorCount,
  };
}

// 세션 생성 시점에 딱 한 번만 호출됨(§CLAUDE.md 10.1 "메인 탭은 세션 생성
// 시점에 계산해 Notion에 저장" 패턴) — 재방문 시 재호출 안 함, 별도 도구·
// 검색 없이 순수 텍스트 요약이라 저렴하고 빠름. 부가 기능이라 실패해도
// 세션 생성 자체를 막으면 안 됨 — Pixabay/OpenAI 이미지 생성과 같은 원칙으로
// 절대 throw 안 하고 null만 반환.
export async function generateInsightReport(input: InsightReportInput): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    const text = textBlock.text.trim();
    return text || null;
  } catch (err) {
    console.error("[generateInsightReport] failed:", err);
    return null;
  }
}
