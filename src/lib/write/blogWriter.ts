import Anthropic from "@anthropic-ai/sdk";
import { getCategoryRuleText, getSponsorshipRuleText, type BlogCategory } from "./blogRules";
import type { TopRankFormatProfile } from "./topRankFormat";
import { formatKstDateTime } from "@/lib/utils/formatDate";
import { getNewsGroundingContext } from "./newsGrounding";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 8192;

// 2026-08 v2 개편(new_blog/ezzsearch-ai-draft-block-format-v2.md) — 이미지/영상/
// 인용구/구분선/표/장소/링크는 더 이상 인라인 토큰([사진N: 캡션])이 아니라
// 독립된 블록 마크업 `[[TAG: key=value | key2="value2" | ...]]`으로 표시함.
// 파싱은 src/lib/write/parseBody.ts가 하므로, 여기 문법 설명이 그 파서의
// 실제 구현과 항상 일치해야 함 — 어느 한쪽만 고치지 말 것.
const SYSTEM_PROMPT = `당신은 네이버 블로그에 익숙한 한국어 블로그 작가입니다. 사용자가 올린 사진(있다면)과
요청사항을 참고해서, 네이버 블로그 에디터에 바로 붙여넣을 수 있는 완성된 글을 작성하세요.
사진을 한 장도 올리지 않았을 수도 있습니다 — 그 경우 사진 없이도 프롬프트 내용만으로 충분히
완성된 글을 쓰세요(부족하다고 거부하거나 사진을 요구하지 마세요).

규칙:
- 친근하고 자연스러운 존댓말 블로그 톤으로 씁니다 (딱딱한 설명문 금지).
- **제목·본문 어디에도 이모지·픽토그램(📌☕😊✨ 등 그림문자)을 쓰지 마세요.** 강조나 장식이
  필요하면 문서에서 흔히 쓰는 특수문자(예: ◆ ▶ ※ · — 등)나 **강조 표시**(아래 항목)를
  쓰세요 — 화면에 표시될 때 소제목·목록은 이미 자동으로 꾸며지므로(색·굵기·구분선·원문자)
  직접 이모지나 추가 특수문자를 넣을 필요가 없습니다.
- **제목에는 "[광고]", "[협찬]", "#광고" 같은 표기를 절대 넣지 마세요.** 광고·협찬 표기가
  필요하면(아래 "협찬 여부" 안내 참고) 본문 첫 줄에만 넣으세요.
- 본문 안에 소제목을 넣을 위치마다 그 줄 맨 앞에 "## "를 붙이세요 (예: "## 첫인상은 이랬어요").
  화면에 표시될 때 소제목은 자동으로 꾸며지니(색·굵기·구분선) 소제목 문구 자체에 마크다운
  기호나 이모지를 더 넣을 필요는 없습니다.
- **문단과 문단 사이는 예외 없이 항상 줄바꿈 두 번(빈 줄 하나)으로 구분하세요 — 절대
  하나의 문단으로 길게 이어 쓰지 마세요.** 한 문단은 2~4문장 정도로 짧게 유지하고,
  화제·시점·논지가 조금이라도 바뀌면 바로 새 문단으로 나누세요. 소제목 하나 아래에도
  보통 여러 개의 짧은 문단이 들어가야 정상입니다 — 긴 문단 하나로 때우면 안 됩니다.
- 항목을 나열할 때(정리·목차·단계별 설명·장단점 등)는 리스트 문법을 쓰세요: 순서 상관없는
  목록은 각 줄 맨 앞에 "- "를, 순서가 있는 목록은 "1. ", "2. "처럼 번호를 붙이세요. 목록의
  각 줄은 빈 줄 없이 바로 이어서 쓰세요(줄바꿈 한 번). 화면에서는 원문자(①②③)나 화살표
  기호로 자동 스타일링되니 목록 안에 직접 특수문자를 넣을 필요는 없습니다.
- 본문 중 강조하고 싶은 짧은 문구(핵심 정보·숫자·결론 등)는 "**문구**"처럼 별표 두 개로
  감싸세요. 문단마다 많아야 1~2곳 — 남발하면 오히려 안 읽힙니다.
- **저품질 판정을 피하기 위한 구체적 지침은 아래에 첨부되는 "저품질 방지 심층 가이드"를
  반드시 따르세요** (도입부·마무리 패턴, 1인칭 경험, 구조화 요소 등).
- **최신 정보가 필요한 내용(가격·요금, 최근 트렌드, 현재 진행 중인 이벤트·시즌, 통계 수치,
  뉴스성 사실, "요즘"/"최근"/"올해" 같은 시간 표현이 들어가는 서술 등)은 절대 학습된
  지식만으로 추측해서 쓰지 마세요.** 아래 안내된 오늘 날짜를 기준으로 판단하고, 아래에
  "참고 자료" 섹션이 첨부돼 있다면 그 안에 나온 사실·수치만 인용하세요(그 섹션이 없거나
  "검색 안내"만 있다면 이번 요청은 시간 민감 정보 검색을 안 했거나 결과가 없었다는
  뜻이니, 구체적 수치·시점은 지어내지 말고 일반적인 표현으로 돌려 쓰세요).

## 블록 마크업 (이미지·영상·인용구·구분선·표·장소·링크)

이미지/영상/인용구/구분선/표/장소/링크는 문단 안에 섞어 쓰지 말고, 반드시 **앞뒤에 빈 줄을 두고
그 줄 하나에만** 아래 형식으로 씁니다: \`[[TAG: key=value | key2="쉼표, 포함값" | ...]]\`
(값에 쉼표가 들어가면 반드시 큰따옴표로 감싸세요. TAG만 있고 속성이 없는 경우도 있습니다.)

- **사진**: 실제 업로드된 사진을 배치할 자리. 정밀하게 한두 장만 놓을 땐 SLOT, 여러 장을
  한꺼번에(갤러리로) 배치할 땐 GALLERY를 쓰세요.
  \`[[SLOT: 이미지 | 개수=1 | 역할=대표컷 | 사진=1 | 힌트="카페 입구 전경"]]\`
  \`[[GALLERY: 이미지 | 개수=8 | 배치=그리드 | 사진=2-9 | 힌트="수업 스냅샷 모음"]]\`
  - "사진=" 값은 **업로드된 사진의 1부터 시작하는 순서 번호**입니다. 쉼표로 나열("1,3,5")하거나
    범위("4-12")로 쓸 수 있고 섞어도 됩니다("1,4-6").
  - **업로드된 사진 개수보다 많은 번호를 쓰지 마세요.** 사진이 한 장도 없으면 이미지 SLOT/GALLERY를
    절대 쓰지 마세요.
  - "배치"는 GALLERY에서만: 그리드 | 슬라이드 | 콜라주 중 하나.
- **영상**: 사용자가 영상을 올리지 않으므로 실제 파일은 없지만, "이 자리에 영상을 넣으면 좋다"는
  자리 표시로 씁니다. \`[[SLOT: 영상 | 개수=1 | 역할=수업하이라이트 | 힌트="15초 요약 영상 추천"]]\`
- **스톡 이미지**: 업로드 사진으로 부족할 때 무료 스톡 사진으로 보완할 자리.
  \`[[SLOT: 스톡이미지 | 개수=1 | 힌트="카페 인테리어 느낌"]]\` — 이 자리마다 대응하는 영어
  검색어를 "stockImageQueries" 배열에 문서에 나오는 순서대로 담으세요(반드시 영어 키워드 구문 —
  스톡 이미지 검색 서비스가 영어 태그 위주라서).
- **AI 생성 이미지**: 실제 사진·스톡 사진으로 대체하기 어려운 경우(제품 비교표, 데이터
  시각화, 개념 설명용 그래픽 등)에 우선 쓰고, **업로드된 사진이 부족하거나 아예 없는데
  글에 시각 자료가 필요하다면 적극적으로 활용하세요** — 이 경우 사진 자리마다 매번
  망설이지 말고 5개 내외까지 실제로 요청해서 글이 밋밋해지지 않게 하세요(예: 사진이
  0~2장뿐인데 글 구조상 4~5개의 시각 자료 자리가 필요하면, 남는 자리는 AI 생성 이미지로
  채우세요). 다만 개수 자체를 위해 억지로 늘리진 말고 실제로 그 글에 도움이 되는 자리에만
  쓰세요(최대 5개까지, 아래 하드 캡).
  \`[[SLOT: AI이미지 | 개수=1 | 힌트="가격·용량·평점 비교표"]]\` — 이 자리마다 대응하는 상세한
  생성 프롬프트를 "aiImagePrompts" 배열에 문서에 나오는 순서대로 담으세요. 구도·스타일 등
  전반적인 설명은 영어로 써도 되지만(이미지 생성 모델이 영어 지시를 가장 잘 따름), **이미지
  안에 실제로 보이는 글자(제품명, 가격, 항목 라벨 등)는 절대 영어로 옮기지 말고 한국어 그대로
  큰따옴표로 인용해서 넣고 "번역하지 말고 그대로 렌더링하라"고 명확히 지시하세요.** 이미지
  생성 모델은 한글처럼 획이 복잡한 문자를 정확히 그리는 데 한계가 있으니, 이미지 안에 넣는
  한글 텍스트는 짧고 간단하게(단어 1~3개, 항목당 2~5글자 이내) 유지하고 "large, bold, simple
  sans-serif lettering, one short Korean word per label"처럼 크고 굵고 단순한 글자체를
  명시하세요. 예: "A clean product comparison infographic, large bold simple sans-serif
  lettering. Render the following Korean text exactly as written, do not translate to
  English: title '가격 비교', row labels '가격', '용량', '평점' (each label 2-3 characters only)."
- **인용구**: \`[[QUOTE: "강조하고 싶은 한 문장"]]\`
- **구분선**: \`[[DIVIDER]]\`
- **표**: \`[[TABLE: 헤더="A,B,C" | 행1="1,2,3" | 행2="4,5,6"]]\` (행은 필요한 만큼 행1, 행2, 행3...)
- **장소**: \`[[PLACE: 이름="OO학원 3층" | 힌트="네이버 지도 자동 연동"]]\`
- **링크(CTA)**: \`[[LINK: url="https://example.com" | 설명="자세히 보기"]]\`

- 아래에 이 글의 유형("선택된 글 유형")에 대한 작성 규칙이 첨부되어 있습니다. 제목 형식,
  글 구조, 문장 톤, 이미지/영상 권장 개수를 최대한 그대로 반영하고, **그 규칙에 나오는
  특징 마크업(예: TABLE, QUOTE, DIVIDER, PLACE, LINK, GALLERY 등)을 실제로 본문에
  최소 1회 이상 사용하세요** — 소제목·문단만 나열하고 정작 그 유형의 특징적인 블록을
  안 쓰면 밋밋한 글이 됩니다. 다만 억지로 끼워 맞추지는 말고, 그 자리에 실제로 어울리는
  경우에만 자연스럽게 쓰세요.
- 업로드된 사진이 1장 이상 있다면 그중 썸네일(대표 이미지)로 가장 적합한 것 하나를
  고르고("recommendedThumbnail"에 1부터 시작하는 사진 번호) 이유를 짧게 설명하세요. 사진이
  없다면 "recommendedThumbnail"은 0, "thumbnailReason"은 빈 문자열로 응답하세요.
- 네이버 블로그 태그 입력창에 붙여넣을 수 있는 한국어 해시태그 스타일 추천 태그를 5~8개
  뽑아 "tags" 배열에 담으세요. "#" 기호는 붙이지 마세요.
- 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트를 앞뒤에 붙이지 마세요.

{
  "title": "블로그 글 제목 (광고 표기 없이)",
  "body": "본문 전체 (문단 구분은 줄바꿈 두 번, ## 소제목, - 또는 1. 목록, **강조**, [[SLOT/GALLERY/QUOTE/DIVIDER/TABLE/PLACE/LINK: ...]] 블록 포함)",
  "recommendedThumbnail": 1,
  "thumbnailReason": "왜 이 사진을 추천하는지 한 문장 (사진 없으면 빈 문자열)",
  "tags": ["태그1", "태그2"],
  "stockImageQueries": ["english keyword phrase", "another phrase"],
  "aiImagePrompts": ["detailed prompt (English for style/composition, but any in-image text must be quoted Korean with an explicit 'do not translate' instruction)"]
}`;

export interface BlogWriterImage {
  base64: string; // no "data:image/...;base64," prefix
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export interface BlogWriterResult {
  title: string;
  body: string;
  recommendedThumbnail: number; // 0 = 추천 썸네일 없음(업로드된 사진이 없었음)
  thumbnailReason: string;
  tags: string[];
  stockImageQueries: string[];
  aiImagePrompts: string[];
}

// 사용자 요청(2026-07): 제목에 광고·협찬 표기가 남지 않게 해달라는 요청 —
// 시스템 프롬프트로 지시했지만 모델이 가끔 놓칠 수 있어 방어적으로 한 번 더
// 걷어냄. 협찬 표기는(협찬 토글이 켜졌을 때만) 본문 첫 줄에만 넣도록
// 블로그글쓰기규칙_협찬표기.md가 지시하므로, 제목에서 발견되면 순수하게
// 실수로 봐도 됨.
const AD_TAG_PATTERN = /^(\[(광고|협찬|AD|PR)\]\s*|#(광고|협찬)\s*)/i;

function stripAdTagFromTitle(title: string): string {
  return title.replace(AD_TAG_PATTERN, "").trim();
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("응답에서 JSON을 찾을 수 없습니다.");
  }
  return text.slice(start, end + 1);
}

function parseResult(text: string, imageCount: number): BlogWriterResult {
  const parsed = JSON.parse(extractJson(text));

  const rawTitle = typeof parsed.title === "string" ? parsed.title : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";
  if (!rawTitle || !body) throw new Error("생성된 글에 제목 또는 본문이 없습니다.");
  const title = stripAdTagFromTitle(rawTitle);

  const rawThumbnail = Number(parsed.recommendedThumbnail);
  const recommendedThumbnail =
    imageCount > 0 && Number.isInteger(rawThumbnail) && rawThumbnail >= 1 && rawThumbnail <= imageCount
      ? rawThumbnail
      : 0;

  const thumbnailReason =
    recommendedThumbnail > 0 && typeof parsed.thumbnailReason === "string" ? parsed.thumbnailReason : "";

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t: unknown): t is string => typeof t === "string").slice(0, 8)
    : [];
  const stockImageQueries = Array.isArray(parsed.stockImageQueries)
    ? parsed.stockImageQueries.filter((q: unknown): q is string => typeof q === "string").slice(0, 4)
    : [];
  // 서버 쪽 하드 캡 — 시스템 프롬프트가 "최대 5개"라고 안내하지만, 모델이 지시를
  // 안 지켜도 비용 폭주를 막는 최종 안전장치.
  const aiImagePrompts = Array.isArray(parsed.aiImagePrompts)
    ? parsed.aiImagePrompts.filter((p: unknown): p is string => typeof p === "string").slice(0, 5)
    : [];

  return { title, body, recommendedThumbnail, thumbnailReason, tags, stockImageQueries, aiImagePrompts };
}

// 2026-08 비용 절감(사용자 신고 — "비용이 너무 많이 나가는 것 같다, 다른 방법
// 없나") — Anthropic의 유료 web_search 도구(동적 필터링 web_search_20260209가
// 모델이 직접 짠 파이썬 코드로 검색 결과를 처리하다 `TypeError`/
// "detection_timeout"으로 반복 실패해서 "주가 시황" 하나에 검색 14회·입력
// 토큰 14만개까지 나온 사례를 실측 확인함)를 아예 없애고, 이 프로젝트가 이미
// 무료로 쓰는 네이버 오픈API 뉴스검색으로 대체함(`newsGrounding.ts`) — 시간
// 민감 키워드가 있을 때만 Claude 호출 *전에* 뉴스검색을 1회 미리 하고 결과를
// 프롬프트에 근거자료로 넣어줌. Claude 쪽엔 검색 도구 자체를 안 붙이므로
// 에이전틱 재시도가 구조적으로 발생할 수 없음.
const TIME_SENSITIVE_KEYWORDS = [
  "가격",
  "요금",
  "비용",
  "시세",
  "환율",
  "종가",
  "주가",
  "순위",
  "랭킹",
  "트렌드",
  "유행",
  "최신",
  "신상",
  "신제품",
  "출시",
  "할인",
  "프로모션",
  "이벤트",
  "세일",
  "특가",
  "뉴스",
  "소식",
  "통계",
  "지수",
  "시황",
  "올해",
  "이번달",
  "이번주",
  "요즘",
  "최근",
];

function looksTimeSensitive(text: string): boolean {
  return TIME_SENSITIVE_KEYWORDS.some((keyword) => text.includes(keyword));
}

// generateBlogPost와 reviseBlogPost가 공유하는 실제 호출부 — 시스템 프롬프트
// 구성/파싱 로직은 완전히 같고, user 턴에 들어가는 텍스트(최초 프롬프트 vs
// "기존 글 + 수정 요청")만 다르므로 여기로 몰아둠. sponsored는 16개 유형과
// 별개 축(§CLAUDE.md 16.2) — 켜져 있을 때만 공정위 표기 규칙을 시스템
// 프롬프트에 추가로 붙인다.
async function callClaude(
  images: BlogWriterImage[],
  userText: string,
  category: BlogCategory,
  sponsored: boolean,
  formatProfile: TopRankFormatProfile | null,
  searchQuery: string
): Promise<BlogWriterResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing environment variable: ANTHROPIC_API_KEY");

  const anthropic = new Anthropic({ apiKey });

  const imageBlocks: Anthropic.ImageBlockParam[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mimeType, data: img.base64 },
  }));

  const sponsorshipSection = sponsored
    ? `\n\n## 협찬 여부: 이 글은 협찬(광고비 또는 물품)을 받고 씁니다\n\n${getSponsorshipRuleText()}`
    : "";

  // 사용자 요청(2026-08) — 타겟 키워드를 입력하면 그 키워드로 네이버에서
  // 검색되는 상위 블로그 글들의 "형태"(구조 통계)를 16개 유형 공통 기본
  // 포맷으로 참고시킴. 절대 실제 문장은 안 주고 숫자만 준다 — 표절/저품질
  // 위험을 스스로 만들지 않기 위함(lowQualityRisk.ts와 같은 원칙).
  const formatSection =
    formatProfile && formatProfile.sampleSize > 0
      ? `\n\n## "${formatProfile.keyword}" 키워드 상위 노출 글 형태 참고 (실제 문장·내용 아님, 구조 통계만)\n\n네이버에서 이 키워드로 검색했을 때 상위에 노출되는 블로그 글 ${formatProfile.sampleSize}개를 분석한 평균 형태입니다:\n${formatProfile.avgCharCount != null ? `- 평균 글자수: 약 ${formatProfile.avgCharCount}자\n` : ""}${formatProfile.avgImageCount != null ? `- 평균 이미지 수: 약 ${formatProfile.avgImageCount}장\n` : ""}${formatProfile.avgQuoteCount != null ? `- 평균 인용구 수: 약 ${formatProfile.avgQuoteCount}개\n` : ""}${formatProfile.avgLinkCount != null ? `- 평균 링크 수: 약 ${formatProfile.avgLinkCount}개\n` : ""}\n이 분량·구성을 기본 기준으로 삼아 비슷하게(±20% 정도 여유) 맞춰서 쓰세요. **다만 이건 어디까지나 길이·구조 참고용 통계일 뿐, 실제 상위 노출 글의 문장이나 표현이 아닙니다 — 절대로 다른 글을 베끼거나 비슷하게 흉내 내지 말고, 완전히 새로운 내용과 표현으로 작성하세요.**`
      : "";

  // 2026-08 추가(사용자 신고 — "2~3년 전 정보를 보여주는 경우가 많다") — 프롬프트에
  // 오늘 날짜가 전혀 없어서 모델이 "최근"/"올해" 같은 상대 시점을 판단할 기준이
  // 없었음. 날짜만이 아니라 요청 시각(시:분)까지 주입 — 사용자 요청(2026-08,
  // "명령 시간 정보까지 같이 주입") — 시즌/시간대별 문구("아침엔"/"주말에만")까지
  // 정확히 판단하려면 날짜만으로는 부족해서임.
  const dateSection = `\n\n## 지금 시각\n\n지금은 ${formatKstDateTime(Date.now())}(한국시간)입니다. 시간 관련 표현이나 최신 정보 판단은 이 시각을 기준으로 하세요.`;

  // 2026-08 비용 절감 — Anthropic web_search 도구는 완전히 제거하고, 키워드
  // 휴리스틱에 걸릴 때만 Claude 호출 *전에* 무료 네이버 뉴스검색을 1회 미리 해서
  // 결과를 프롬프트에 근거자료로 넣음(newsGrounding.ts). 검색 결과가 없거나
  // 애초에 검색을 안 했으면 안내문만 붙여서, 모델이 확실치 않은 수치를 지어내지
  // 않고 일반적인 표현으로 돌려 쓰게 유도함.
  const needsSearch = looksTimeSensitive(searchQuery);
  const newsContext = needsSearch ? await getNewsGroundingContext(searchQuery) : "";
  const groundingSection =
    newsContext ||
    `\n\n## 최신 정보 검색 안내\n\n${
      needsSearch
        ? "이번 요청과 관련된 최신 뉴스를 검색했지만 참고할 만한 결과를 찾지 못했습니다."
        : "이번 요청에는 시간 민감 정보가 많이 필요해 보이지 않아 별도로 검색하지 않았습니다."
    } 시점에 따라 달라질 수 있는 구체적 수치·사실은 지어내지 말고 일반적인 표현으로 돌려 쓰세요.`;

  const systemPrompt = `${SYSTEM_PROMPT}\n\n## 선택된 글 유형: ${category}\n\n${getCategoryRuleText(category)}${sponsorshipSection}${formatSection}${dateSection}${groundingSection}`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: userText }],
      },
    ],
  });

  const textBlocks = message.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const lastTextBlock = textBlocks[textBlocks.length - 1];
  if (!lastTextBlock) {
    throw new Error("Claude 응답에서 텍스트를 찾을 수 없습니다.");
  }

  return parseResult(lastTextBlock.text, images.length);
}

export async function generateBlogPost(
  images: BlogWriterImage[],
  prompt: string,
  category: BlogCategory,
  sponsored: boolean,
  formatProfile: TopRankFormatProfile | null = null
): Promise<BlogWriterResult> {
  return callClaude(images, prompt, category, sponsored, formatProfile, prompt);
}

// 이미 생성된 글에 "제목을 더 짧게", "3번째 문단 빼줘" 같은 수정 요청을 반영해
// 다시 쓰게 함. 유형(category)·협찬 여부(sponsored)는 최초 생성 때 정해진 걸
// 그대로 유지 — 재분류하지 않음(사용자가 바꿔달라고 한 게 아니므로). 사진도
// 다시 같이 보내는 이유: 수정 요청이 사진 배치·설명과 관련될 수도 있어서
// (예: "사진1 힌트를 더 자세히 써줘") 매번 새로 맥락을 줘야 함 — 이 API가
// 대화 상태를 유지하는 게 아니라 매 호출이 독립적인 단발 요청이기 때문.
export async function reviseBlogPost(
  images: BlogWriterImage[],
  previous: Pick<BlogWriterResult, "title" | "body" | "tags">,
  instruction: string,
  category: BlogCategory,
  sponsored: boolean,
  formatProfile: TopRankFormatProfile | null = null
): Promise<BlogWriterResult> {
  const userText = `기존에 작성한 글입니다.

제목: ${previous.title}

본문:
${previous.body}

태그: ${previous.tags.join(", ")}

사용자의 수정 요청: "${instruction}"

위 수정 요청만 반영해서 전체 글을 다시 작성하세요. 요청하지 않은 부분(사진·스톡·AI이미지
배치, 나머지 문단, 톤 등)은 원래 내용을 최대한 그대로 유지하세요. 응답은 처음 글쓰기
때와 똑같은 JSON 형식으로 하세요.`;

  // 검색 쿼리는 이 큰 userText 전체가 아니라 instruction(사용자가 방금 요청한
  // 수정 내용)만 씀 — "기존 글 전체 + 수정 요청"을 통째로 뉴스검색 쿼리로
  // 보내면 본문 문장이 섞여 들어가 검색 관련도가 떨어짐.
  return callClaude(images, userText, category, sponsored, formatProfile, instruction);
}
