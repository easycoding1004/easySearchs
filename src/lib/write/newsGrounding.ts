import { searchNews } from "@/lib/naver/openApiClient";

// 2026-08 추가(사용자 요청 — "Claude API 비용이 너무 많이 나가는 것 같다, 다른
// 방법 없어?") — Anthropic의 유료 web_search 도구(에이전틱 검색 루프, 실측으로
// 검색 14회·입력 토큰 14만개까지 나온 사례 확인)를 아예 안 쓰고, 이 프로젝트가
// 이미 무료로 쓰고 있는 네이버 오픈API 뉴스검색(openApiClient.ts, 과금 없이
// 공유 스로틀만 거침)으로 Claude를 부르기 *전에* 한 번만 미리 검색해서 그 결과를
// 프롬프트에 근거자료로 넣어주는 방식. Claude 쪽엔 검색 도구 자체를 안 붙이므로
// 에이전틱 재시도(생각·code_execution)가 구조적으로 발생할 수 없음 — 검색 비용은
// 이 함수 안의 뉴스검색 1회로 고정됨.
const MAX_ITEMS = 5;
const MAX_DESCRIPTION_LENGTH = 200;

function stripHighlightMarkup(text: string): string {
  return text
    .replace(/<\/?b>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// 부가 기능 실패가 나머지 글 생성을 막으면 안 됨(§16의 Pixabay/OpenAI 이미지
// 생성과 같은 원칙) — 검색 실패·결과 없음 시 빈 문자열만 반환, 호출부가 그 경우
// 시스템 프롬프트에 "일반적인 표현으로 돌려 쓰라"는 안내를 대신 넣는다.
export async function getNewsGroundingContext(query: string): Promise<string> {
  try {
    const { items } = await searchNews(query, { display: MAX_ITEMS, sort: "date" });
    if (items.length === 0) return "";

    const lines = items.map((item, i) => {
      const title = stripHighlightMarkup(item.title);
      const description = stripHighlightMarkup(item.description).slice(0, MAX_DESCRIPTION_LENGTH);
      return `${i + 1}. [${item.pubDate}] ${title}\n   ${description}`;
    });

    return `\n\n## 참고 자료 (방금 네이버 뉴스에서 검색한 최신 기사 ${items.length}건)\n\n${lines.join(
      "\n\n"
    )}\n\n**위 자료에 나온 사실·수치만 인용하세요. 여기 없는 구체적 수치·시점은 절대 지어내지 말고, 확인 안 되는 부분은 일반적인 표현으로 돌려 쓰세요.**`;
  } catch {
    return "";
  }
}
