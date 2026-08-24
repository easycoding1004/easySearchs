import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";

// 루리웹 핫딜/예판 게시판 공식 RSS — 인증 불필요, 루리웹이 의도적으로
// 공개하는 피드라 스크래핑보다 안전함(googleTrends/client.ts의 구글 트렌드
// RSS와 같은 원칙, §CLAUDE.md 6.3). 실측 확인: 뽐뿌·알구몬은 공식 RSS가
// 없어(뽐뿌는 이용약관에 무단복제·배포 관련 조항이 있어 스크래핑 리스크가
// 있고, 알구몬은 뽐뿌·루리웹 등을 재수집하는 2차 아카이브라 저작권이 더
// 애매함) 사용자와 논의 후 루리웹 하나로 범위를 좁힘.
const RSS_URL = "https://bbs.ruliweb.com/market/board/1020/rss";
const USER_AGENT = "ezzsearch.com (hotdeal board)";

export interface RuliwebDeal {
  sourceId: string; // 원본 게시글 URL(고유) — dedup 키
  title: string;
  link: string;
  author: string;
  category: string;
  thumbnailUrl: string | null;
  price: number | null; // 제목에서 정규식으로 추출한 가격(원) — 못 찾으면 null
  pubDate: string; // ISO 8601
}

const parser = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === "item" });

interface RawItem {
  title?: string;
  link?: string;
  author?: string;
  category?: string;
  description?: string;
  pubDate?: string;
}

// "9,100원"/"13990원" 등 제목에 박힌 가격 — 한 제목에 여러 금액이 있으면
// 첫 번째를 대표 가격으로 씀(예: "상스치 3600원, 맥플러리 1800원" → 3600).
// 완벽한 파싱은 아니라 참고용 근사치.
const PRICE_PATTERN = /([\d,]{2,})\s*원/;

function extractPrice(title: string): number | null {
  const match = title.match(PRICE_PATTERN);
  if (!match) return null;
  const digits = match[1].replace(/,/g, "");
  const price = Number(digits);
  return Number.isFinite(price) && price > 0 ? price : null;
}

// description은 대부분 <img ... src="..."> 썸네일 하나뿐(실측 확인) — 그
// src만 뽑아 씀.
function extractThumbnail(description: string): string | null {
  const match = description.match(/<img[^>]+src="([^"]+)"/);
  return match ? match[1] : null;
}

function parseItem(raw: RawItem): RuliwebDeal | null {
  if (!raw.title || !raw.link) return null;
  // pubDate는 "Mon, 24 Aug 2026 08:00:25 +0900" 형태로 타임존 오프셋이
  // 명시돼 있어(실측 확인) bizinfo RSS와 달리 별도 KST 보정이 필요 없음.
  const pubDate = raw.pubDate ? new Date(raw.pubDate) : null;

  return {
    sourceId: raw.link,
    title: raw.title,
    link: raw.link,
    author: raw.author ?? "",
    category: raw.category ?? "",
    thumbnailUrl: extractThumbnail(raw.description ?? ""),
    price: extractPrice(raw.title),
    pubDate: pubDate && !isNaN(pubDate.getTime()) ? pubDate.toISOString() : new Date().toISOString(),
  };
}

// 사용자 요청(2026-08) — 게임/게임기기 관련 딜은 이 게시판(생활용품 핫딜 성격)
// 취지와 안 맞아 제외. 실측으로 확인한 이 피드의 카테고리 값은 PC/가전,
// 게임S/W, 상품권, 생활용품, 음식 — "게임"이 들어간 값만 걸러내면 됨(부분
// 일치로 향후 "게임기기" 같은 변형에도 대응).
const EXCLUDED_CATEGORY_KEYWORD = "게임";

export async function fetchRuliwebDeals(): Promise<RuliwebDeal[]> {
  const response = await fetch(RSS_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`루리웹 RSS HTTP 오류 (${response.status})`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as { rss?: { channel?: { item?: RawItem[] } } };
  const rawItems = parsed.rss?.channel?.item ?? [];

  return rawItems
    .map(parseItem)
    .filter((item): item is RuliwebDeal => item !== null)
    .filter((item) => !item.category.includes(EXCLUDED_CATEGORY_KEYWORD));
}

// 2026-08 추가(사용자 요청 — "본문 내용을 그대로 웹크롤링해서 넣어줘") —
// 사용자와 논의 후 **원문 전체를 그대로 재게시하지 않고 짧은 요약만** 만들어
// 넣기로 확정함(§CLAUDE.md 21.6에서 뽐뿌를 저작권 우려로 제외했던 것과
// 같은 이유가 루리웹 원문 전문 재게시에도 그대로 적용되기 때문). 이 함수는
// 게시물 페이지에서 본문 텍스트 + 게시자가 지정한 구매 링크를 함께 뽑아옴
// (2026-08 추가 요청 — "구입 링크를 직접 연결해서 상품 내용을 스크랩해줘",
// 구매 링크는 productPreview.ts가 best-effort로 따라감). 실제 "요약"(자르기)은
// summarizeText()가 호출부에서 담당 — 여기서는 원문을 그대로 반환.
// 실측 확인(2026-08): 본문은 `.view_content` 안에 <p> 위주로 들어있고,
// 이미지/외부링크 태그가 섞여 있어 cheerio로 텍스트만 뽑아냄.
const USER_AGENT_POST = "ezzsearch.com (hotdeal board)";

export interface RuliwebPostDetail {
  bodyText: string;
  // 게시자가 붙인 "출처" 구매 링크 — 실측 확인(2026-08): .source_url 블록에
  // 있는 링크가 게시자 스스로 지정한 구매처라 본문 안에 섞인 다른 링크(제품
  // 이미지 원본, 관련 딜 언급 등)보다 신뢰도가 높음. 없으면 본문 안 첫
  // 외부(http) 링크로 폴백.
  purchaseLink: string | null;
}

export async function fetchRuliwebPostDetail(url: string): Promise<RuliwebPostDetail | null> {
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT_POST } });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    const content = $(".view_content").first();
    if (content.length === 0) return null;

    let purchaseLink = $(".source_url a[href^='http']").first().attr("href") ?? null;
    if (!purchaseLink) {
      purchaseLink = content.find("a[href^='http']").first().attr("href") ?? null;
    }

    content.find("script, style").remove();
    const nbsp = String.fromCharCode(160);
    const bodyText = content
      .text()
      .split(nbsp)
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim();

    return { bodyText, purchaseLink };
  } catch {
    return null;
  }
}

const SUMMARY_MAX_LENGTH = 200;

// 원문을 그대로 저장하지 않고 짧게 잘라 요약처럼 보이게 함 — AI 요약이
// 아니라 단순 절단(단어 경계에서 자름)이지만, 원문 대비 재생산되는 분량을
// 크게 줄여 저작권 리스크를 낮추는 목적에는 충분함(비용도 안 듦 — 시간당
// 20여 건마다 Claude를 부르지 않음).
export function summarizeText(text: string, maxLength: number = SUMMARY_MAX_LENGTH): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  const cut = collapsed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const safeCut = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${safeCut}…`;
}
