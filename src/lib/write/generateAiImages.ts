import { getErrorMessage } from "@/lib/utils/errors";

// OpenAI Images API (공식 문서 확인 후 구현, 추측 없음):
// POST https://api.openai.com/v1/images/generations, Authorization: Bearer,
// gpt-image-1 계열은 항상 base64(data[].b64_json)로만 응답함(url 옵션 없음).
const ENDPOINT = "https://api.openai.com/v1/images/generations";
const MODEL = "gpt-image-1";
const SIZE = "1536x1024"; // 블로그 본문에 자연스러운 가로형
const QUALITY = "medium"; // 비용 절제 — 제품 비교/개념 설명용이라 고화질까지는 불필요
const FETCH_TIMEOUT_MS = 60000; // 이미지 생성은 스톡 검색보다 훨씬 오래 걸림

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
