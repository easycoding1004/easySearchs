import { searchBlog } from "@/lib/naver/openApiClient";
import { fetchPostContentStats, type ContentStats } from "@/lib/naver/blogEngagementScraper";
import { createTtlCache } from "@/lib/utils/ttlCache";

// 2026-08 추가(사용자 요청 — "네이버 특정 키워드로 입력됐을 때 노출순위가
// 높은 블로그를 스크래핑해서 16가지 형태를 작성할 때 기본 포맷으로
// 설정해줘"): AI 블로그 자동글쓰기에 "타겟 키워드"를 입력하면, 그 키워드로
// 네이버 블로그 검색(공식 오픈API, sort=sim이 상대적 관련도순 — 실질적으로
// 상위 노출과 가장 가까운 공식 정렬 기준) 상위 글들의 "형태"(글자수·이미지
// 수·인용구·링크 수)만 뽑아서 시스템 프롬프트에 참고 자료로 얹는다.
//
// ⚠️ 중요한 안전장치: 이 프로필에는 절대 실제 문장·내용을 담지 않는다 —
// 구조 통계만 담아서, Claude가 경쟁 글의 표현을 베낄 위험(그리고 그로 인한
// 저품질/표절 위험 — lowQualityRisk.ts가 잡으려는 바로 그 문제)을 원천
// 차단한다. 스크래핑 자체는 §CLAUDE.md 10.4에서 이미 승인된
// blogEngagementScraper.ts의 본문 구조 파싱 로직(cheerio, se-main-container
// 등 안정적 클래스명 기반)을 그대로 재사용 — 새 스크래핑 기법을 추가한 게
// 아니라 기존에 승인된 걸 "사용자가 지정한 블로그"가 아니라 "키워드 검색으로
// 찾은 블로그"에 적용하는 확장.
const SAMPLE_SIZE = 5;
const REQUEST_SPACING_MS = 400; // blogEngagementScraper.ts와 동일한 페이싱
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 같은 파일의 ANALYSIS_CACHE_TTL_MS와 동일 기준

export interface TopRankFormatProfile {
  keyword: string;
  sampleSize: number;
  avgCharCount: number | null;
  avgImageCount: number | null;
  avgQuoteCount: number | null;
  avgLinkCount: number | null;
}

const cache = createTtlCache<string, TopRankFormatProfile>(CACHE_TTL_MS);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// 부가 기능(있으면 좋고, 실패해도 글 생성 자체는 절대 안 막혀야 함) —
// imageSearch.ts/generateAiImages.ts와 동일한 계약: 항상 null만 반환하고
// throw하지 않음.
export async function getTopRankFormatProfile(keyword: string): Promise<TopRankFormatProfile | null> {
  const trimmed = keyword.trim();
  if (!trimmed) return null;

  const cached = cache.get(trimmed);
  if (cached) return cached;

  try {
    // sort 옵션을 안 주면 기본값 sim(관련도순)이라 명시적으로 안 넘겨도 되지만,
    // 의도를 코드에도 남겨두는 게 명확함.
    const { items } = await searchBlog(trimmed, { sort: "sim", display: SAMPLE_SIZE });
    const links = items.map((i) => i.link).filter((link) => /blog\.naver\.com\//.test(link));
    if (links.length === 0) return null;

    const stats: ContentStats[] = [];
    for (const link of links) {
      await sleep(REQUEST_SPACING_MS);
      const s = await fetchPostContentStats(link);
      if (s) stats.push(s);
    }
    if (stats.length === 0) return null;

    const profile: TopRankFormatProfile = {
      keyword: trimmed,
      sampleSize: stats.length,
      avgCharCount: average(stats.map((s) => s.charCount)),
      avgImageCount: average(stats.map((s) => s.imageCount)),
      avgQuoteCount: average(stats.map((s) => s.quoteCount)),
      avgLinkCount: average(stats.map((s) => (s.internalLinkCount ?? 0) + (s.externalLinkCount ?? 0))),
    };
    cache.set(trimmed, profile);
    return profile;
  } catch {
    return null;
  }
}
