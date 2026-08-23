import { XMLParser } from "fast-xml-parser";
import { POLICY_CATEGORY } from "@/lib/notion/schema";
import type { PolicyCategory } from "@/lib/notion/policyBoard";

// 기업마당(bizinfo.go.kr) 지원사업 공고 오픈API — 실제 발급받은 crtfcKey로
// 호출해 응답을 실측 확인함(2026-08). RSS 2.0 형식이고 각 필드에 기업마당이
// 직접 붙여둔 한글 주석이 있어 정확한 의미를 확인할 수 있었음:
//   title=공고명, link=공고URL, seq/pblancId=공고ID, author/jrsdInsttNm=소관명,
//   description=사업개요내용(HTML), pubDate=등록일자("YYYY-MM-DD HH:mm:ss",
//   타임존 표기 없음 — 한국 서버 로컬시간이라 KST로 명시 파싱해야 함,
//   §CLAUDE.md 15의 UTC 서버 타임존 버그와 같은 함정), reqstDt=신청기간
//   ("시작일 ~ 종료일" 텍스트), hashtags=해시태그(쉼표구분).
// guid 필드는 없음(RSS 표준과 다름) — sourceId는 pblancId를 씀.
const RSS_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do";
const USER_AGENT = "ezzsearch.com (small business policy board)";
const SEARCH_COUNT = 50;

export interface BizinfoAnnouncement {
  sourceId: string;
  title: string;
  description: string;
  link: string;
  organization: string;
  pubDate: string; // ISO 8601 (KST로 명시 파싱)
  deadline: string | null; // YYYY-MM-DD, reqstDt의 종료일
  category: PolicyCategory;
}

const parser = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === "item" });

interface RawItem {
  title?: string;
  link?: string;
  pblancId?: string;
  author?: string;
  description?: string;
  pubDate?: string;
  reqstDt?: string;
}

// "YYYY-MM-DD HH:mm:ss" 형태(타임존 표기 없음, 실측 확인) — 서버가 어느
// 타임존에서 돌든 한국 시간으로 고정 해석되도록 명시적으로 +09:00을 붙여서
// Date에 넘김(formatDate.ts의 KST 유틸과 같은 문제의식, 여기선 파싱 시점이라
// 별도 헬퍼로 처리).
function parseKstDateTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const isoLike = `${trimmed.replace(" ", "T")}+09:00`;
  const date = new Date(isoLike);
  return isNaN(date.getTime()) ? "" : date.toISOString();
}

// reqstDt는 "2026-08-20 ~ 2026-09-11" 형태(실측 확인) — 종료일(마감일)만
// 뽑아 씀. 날짜만 있고 시각이 없어 그대로 Notion date 문자열로 써도 안전
// (시간대 계산이 끼어들 여지가 없음).
function parseDeadline(reqstDt: string | undefined): string | null {
  if (!reqstDt) return null;
  const parts = reqstDt.split("~").map((p) => p.trim());
  const end = parts[parts.length - 1];
  return /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : null;
}

// description이 <p>/<br>/<span style="..."> 같은 HTML을 그대로 담고 있어
// (실측 확인) 게시판 본문(순수 텍스트)에 넣기 전에 태그를 벗기고 흔한
// 엔티티를 디코딩함 — 정교한 HTML 파서(cheerio 등)까지는 필요 없는 단순
// 정리라 여기 한정으로 정규식 처리.
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseItem(raw: RawItem, category: PolicyCategory): BizinfoAnnouncement | null {
  if (!raw.title || !raw.link || !raw.pblancId) return null;

  return {
    sourceId: raw.pblancId,
    title: raw.title,
    description: stripHtml(raw.description ?? ""),
    link: raw.link,
    organization: raw.author ?? "",
    pubDate: parseKstDateTime(raw.pubDate ?? "") || new Date().toISOString(),
    deadline: parseDeadline(raw.reqstDt),
    category,
  };
}

// 카테고리마다 bizinfo가 실제로 쓰는 해시태그로 서버 사이드 검색(hashtags
// 파라미터, 실측으로 진짜 필터링됨을 확인 — 예: hashtags=대출로 융자지원
// 공고가, hashtags=공모전으로 실제 공모전 공고가 나옴). 클라이언트에서
// 제목·설명 텍스트로 추측 분류하는 것보다 훨씬 정확함.
// ⚠️ "소상공인뉴스"는 언론 기사가 아니라 "소상공인" 해시태그로 걸리는
// 소상공인 대상 지원사업 공고임 — 진짜 뉴스 형태 소스는 아직 못 찾음
// (CLAUDE.md 신규 섹션 참고, 나중에 별도 소스가 필요할 수 있음).
const CATEGORY_SEARCH_TERMS: [PolicyCategory, string][] = [
  [POLICY_CATEGORY.loan, "대출"],
  [POLICY_CATEGORY.subsidy, "지원금"],
  [POLICY_CATEGORY.contest, "공모전"],
  [POLICY_CATEGORY.news, "소상공인"],
];

async function fetchByHashtag(apiKey: string, hashtag: string, category: PolicyCategory): Promise<BizinfoAnnouncement[]> {
  const url = new URL(RSS_URL);
  url.searchParams.set("crtfcKey", apiKey);
  url.searchParams.set("searchCnt", String(SEARCH_COUNT));
  url.searchParams.set("hashtags", hashtag);

  const response = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`기업마당 API HTTP 오류 (${response.status})`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as { rss?: { channel?: { item?: RawItem[]; reqErr?: string } } };
  const reqErr = parsed.rss?.channel?.reqErr;
  if (reqErr) {
    throw new Error(`기업마당 API 오류: ${reqErr}`);
  }

  const rawItems = parsed.rss?.channel?.item ?? [];
  return rawItems
    .map((raw) => parseItem(raw, category))
    .filter((item): item is BizinfoAnnouncement => item !== null);
}

// BIZINFO_API_KEY 미설정 시 빈 배열(policyBoardJob.ts가 조용히 건너뜀) —
// Pixabay/OpenAI 이미지 생성과 같은 "부가 기능 미설정 시 무해하게 스킵"
// 계약. 4개 카테고리를 순차 호출한 뒤(정책정보용 별도 스로틀은 없음 — 이
// API가 이 프로젝트에서 유일하게 호출하는 곳이라 공유 큐가 필요 없음),
// pblancId 기준으로 중복 제거(같은 공고가 여러 해시태그에 걸릴 수 있음 —
// 실측 확인, 먼저 매칭된 카테고리를 우선함).
export async function fetchBizinfoAnnouncements(): Promise<BizinfoAnnouncement[]> {
  const apiKey = process.env.BIZINFO_API_KEY;
  if (!apiKey) return [];

  const seen = new Set<string>();
  const merged: BizinfoAnnouncement[] = [];

  for (const [category, hashtag] of CATEGORY_SEARCH_TERMS) {
    const items = await fetchByHashtag(apiKey, hashtag, category);
    for (const item of items) {
      if (seen.has(item.sourceId)) continue;
      seen.add(item.sourceId);
      merged.push(item);
    }
  }

  return merged;
}
