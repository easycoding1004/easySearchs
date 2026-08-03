import { getErrorMessage } from "@/lib/utils/errors";

// OpenAI Images API (공식 문서 확인 후 구현, 추측 없음):
// POST https://api.openai.com/v1/images/generations, Authorization: Bearer,
// gpt-image-1 계열은 항상 base64(data[].b64_json)로만 응답함(url 옵션 없음).
const ENDPOINT = "https://api.openai.com/v1/images/generations";
const MODEL = "gpt-image-1";
const SIZE = "1536x1024"; // 블로그 본문에 자연스러운 가로형
// 2026-07: medium에서 high로 상향 — 실측 결과 한글 텍스트가 미묘하게 틀리는
// 사례(예: "아메리카노"→"아페리카노")가 있어, 비용이 더 들더라도 글자 정확도를
// 우선하기로 사용자와 합의함(프롬프트의 "짧고 굵은 글자" 지시와 함께 적용).
const QUALITY = "high";
// 2026-08 사용자 신고("AI 이미지가 생성이 안 돼") — high 품질 + 1536x1024
// 조합은 실측상 60초를 넘기는 경우가 흔해서, 60초 타임아웃에 걸려 매번
// null로 조용히 실패하고 있었을 가능성이 높음(생성 자체가 안 되는 게 아니라
// 끝나기 전에 우리가 먼저 포기한 것). 120초로 넉넉히 늘림 — /api/write가
// 이제 SSE라 이 단계가 오래 걸려도 사용자에게 "이미지 준비 중..."으로
// 보이므로(진행률 UI), 타임아웃을 늘려도 "먹통처럼 보임" 문제가 없음.
const FETCH_TIMEOUT_MS = 120000;

export interface AiImageResult {
  prompt: string;
  dataUrl: string; // data:image/png;base64,... — 별도 호스팅 없이 바로 <img src>로 씀
}

// 계약은 imageSearch.ts의 searchStockImages와 동일: 절대 throw하지 않음.
// OPENAI_API_KEY 미설정/호출 실패 시 해당 자리만 null — /api/write 전체를
// 실패시키면 안 되는 부가 기능(이미지 생성은 유료라 특히 더 그러함).
// 반환 배열은 입력 prompts와 길이·순서가 항상 1:1로 대응함(본문의 [AI이미지N]
// 토큰이 인덱스로 매핑되므로 — 실패한 항목을 배열에서 걸러내면 번호가 밀려서
// 엉뚱한 이미지가 매칭되는 버그가 생김).
export async function generateAiImages(prompts: string[]): Promise<(AiImageResult | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return prompts.map(() => null);

  return Promise.all(prompts.map((prompt) => generateOne(apiKey, prompt)));
}

async function generateOne(apiKey: string, prompt: string): Promise<AiImageResult | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, prompt, size: SIZE, quality: QUALITY, n: 1 }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[generateAiImages] "${prompt}" failed: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;

    return { prompt, dataUrl: `data:image/png;base64,${b64}` };
  } catch (err) {
    console.error(`[generateAiImages] "${prompt}" failed:`, getErrorMessage(err));
    return null;
  }
}
