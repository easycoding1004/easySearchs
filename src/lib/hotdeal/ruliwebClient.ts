import { XMLParser } from "fast-xml-parser";

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
