import * as cheerio from "cheerio";

const USER_AGENT = "ezzsearch.com (hotdeal board)";
const FETCH_TIMEOUT_MS = 8000;

export interface ProductPreview {
  title: string;
  description: string;
  image: string | null;
}

// 2026-08 추가(사용자 요청 — "구입 링크를 직접 연결해서 상품 내용을 스크랩해줘").
// 게시물의 구매 링크는 매번 다른 임의의 쇼핑몰(카카오스토어/스마트스토어/
// 직구사이트 등)이라 사이트별 셀렉터를 만드는 게 불가능함 — 대신 대부분의
// 상거래 페이지가 소셜 공유 미리보기용으로 이미 공개하는 표준 Open Graph
// 메타태그(og:title/og:description/og:image)만 읽어옴. 이건 사이트가
// "다른 서비스가 가져다 쓰라고" 스스로 공개하는 정보라, 페이지 본문을
// 직접 파싱하는 것보다 저작권·약관 리스크가 낮고 플랫폼에 무관하게 동작함.
//
// 쿠팡·G마켓처럼 이미 스크래핑이 막힌 걸 확인한 사이트(§CLAUDE.md 21.5)를
// 포함해 어떤 사이트든 요청이 실패하면(차단·타임아웃·리다이렉트 실패·OG
// 태그 없음) 조용히 null만 반환 — 사용자와 합의한 "되는 곳만 best-effort로"
// 원칙(§CLAUDE.md 21.6), 이 부가 정보가 없어도 핵심 딜 게시 자체는 막지 않음.
export async function fetchProductPreview(url: string): Promise<ProductPreview | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = ($('meta[property="og:title"]').attr("content") ?? $("title").first().text() ?? "").trim();
    const description = (
      $('meta[property="og:description"]').attr("content") ?? $('meta[name="description"]').attr("content") ?? ""
    ).trim();
    const rawImage = $('meta[property="og:image"]').attr("content")?.trim() || null;
    // og:image가 절대 URL이 아니라 사이트 루트 기준 상대경로로 오는 경우가
    // 실측으로 확인됨(예: "/img/logo.gif") — response.url(리다이렉트 반영된
    // 최종 URL) 기준으로 절대 URL로 변환. 우리 사이트에 그대로 <img src>로
    // 쓰므로 상대경로면 우리 도메인 기준으로 깨짐.
    const image = rawImage
      ? (() => {
          try {
            return new URL(rawImage, response.url).toString();
          } catch {
            return null;
          }
        })()
      : null;

    if (!title && !description) return null;
    return { title, description, image };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
