import type { BlogWriterResult } from "./blogWriter";

// 2026-08 추가 — "저품질 위험도" 지수. 네이버는 저품질 블로그 판정 기준을
// 공식적으로 공개한 적이 없어서(§CLAUDE.md 2의 블로그지수와 같은 원칙),
// 이 지수도 네이버 공식 기준이 아니라 마케팅 대행사·SEO 커뮤니티 글들이
// 공통적으로 지목하는 위험 신호를 사용자 요청으로 실제 웹 검색해 모은 뒤
// (아래 각 체크의 출처 주석 참고), 그중 "생성 시점에 텍스트만으로 측정
// 가능한 것"만 골라 점수화한 자체 추정치다. 화면에 항상 "네이버 공식 기준
// 아님"을 명시할 것.
//
// 측정 불가능해서 일부러 뺀 것들(체류시간·재방문율·발행 빈도·다른 글과의
// 실제 중복 검색 등) — 생성 시점엔 알 수 없거나(계정 행동 패턴), 대상
// 텍스트를 웹 전체와 대조해야 하는(진짜 표절 검사) 별도 스크래핑 기능이
// 필요해서 이번 범위 밖으로 뺌.
export interface LowQualityFlag {
  id: string;
  label: string;
  points: number;
}

export type LowQualityLevel = "낮음" | "보통" | "높음";

export interface LowQualityAssessment {
  totalPoints: number;
  level: LowQualityLevel;
  flags: LowQualityFlag[];
}

// 본문에서 [[TAG: ...]] 블록 마크업과 소제목(##)/강조(**)를 걷어낸 순수
// 텍스트만 남김 — 문장·어절 단위 휴리스틱이 마크업 기호에 흔들리지 않게.
function stripMarkup(body: string): string {
  return body
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .replace(/^##\s?/gm, "")
    .replace(/\*\*/g, "")
    .trim();
}

// 출처: moneyroan.com "AI 블로그 저품질 체크리스트 2026" — "안녕하세요.
// 오늘은 ~에 대해 알아보겠습니다" 식 도입부를 위험 신호로 지목. 두 구간
// 사이에 마침표/줄바꿈이 끼는 경우("안녕하세요. 오늘은~")가 흔해서 `[^\n]`로
// 넉넉하게 허용(문장부호로 끊겨도 매치되게).
const FORMULAIC_OPENING = /^(안녕하세요|반갑습니다)[^\n]{0,40}(오늘은|오늘|이번에는|이번 포스팅에서는)[^\n]{0,30}(알아보겠습니다|알아볼게요|소개해드릴게요|소개해드리겠습니다|이야기해보려고|포스팅해보겠습니다)/;

// 같은 출처 — "이상으로 ~에 대해 알아봤습니다" 식 마무리를 위험 신호로 지목.
const FORMULAIC_CLOSING = /(이상으로|오늘은 이렇게|지금까지)[^\n]{0,40}(알아봤습니다|살펴봤습니다|포스팅을?\s*마치|마무리하겠습니다|마칠까 합니다)/;

// 1인칭 경험/의견 표현 — 출처: moneyroan.com "1인칭 경험이나 의견 전무"가
// 저품질 위험 신호. 하나라도 있으면 통과로 봄(전무할 때만 감점).
const FIRST_PERSON_PATTERN = /(저는|제가|저희|우리\s?(가게|매장|블로그)|직접\s?(가|해|먹|써|써봤|경험))/;

// 출처: catchdon.com — 보험/대출/재무/의약품·뷰티/병원 등은 네이버가 더
// 엄격하게 본다고 지목된 고위험 업종 키워드. 완전 차단이 아니라 감점 신호로만 씀
// (이 업종이라고 무조건 나쁜 글이 되는 게 아니라, 광고성과 겹치면 위험이 커짐).
const HIGH_RISK_INDUSTRY_WORDS = /(보험|대출|재무설계|시술|반영구|병원|한의원|다이어트약|건강기능식품)/;

// 홍보성 문구 — 출처: unsense.co.kr "광고 및 홍보성 문장이 너무 과한 블로그".
const PROMOTIONAL_WORDS = ["지금 바로", "한정", "이벤트", "할인", "클릭", "문의주세요", "예약하세요", "많관부"];

function countOccurrences(text: string, pattern: RegExp): number {
  return (text.match(new RegExp(pattern, "g")) ?? []).length;
}

// 문장을 종결어미 기준으로 대충 쪼갠 뒤, 정규화(공백/조사 무시하지 않는 단순
// 버전)해서 완전히 같은 문장이 여러 번 나오는지만 본다 — 정교한 유사도
// 분석은 아니고 "복붙한 듯한 반복"만 잡는 가벼운 체크.
function countDuplicateSentences(plainText: string): number {
  const sentences = plainText
    .split(/(?<=[.!?요다])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  const seen = new Map<string, number>();
  for (const s of sentences) seen.set(s, (seen.get(s) ?? 0) + 1);
  let duplicates = 0;
  for (const count of seen.values()) {
    if (count > 1) duplicates += count - 1;
  }
  return duplicates;
}

export function assessLowQualityRisk(
  result: Pick<BlogWriterResult, "body" | "tags" | "recommendedThumbnail">,
  sponsored: boolean
): LowQualityAssessment {
  const flags: LowQualityFlag[] = [];
  const plainText = stripMarkup(result.body);
  const leadParagraph = plainText.slice(0, 120);
  const tailParagraph = plainText.slice(-150);

  // 구조 — 출처: moneyroan.com 체크리스트1
  if (FORMULAIC_OPENING.test(leadParagraph)) {
    flags.push({ id: "formulaicOpening", label: "도입부가 \"안녕하세요, 오늘은~\" 같은 뻔한 AI 문구예요", points: 2 });
  }
  if (FORMULAIC_CLOSING.test(tailParagraph)) {
    flags.push({ id: "formulaicClosing", label: "마무리가 \"이상으로 ~ 알아봤습니다\" 같은 뻔한 AI 문구예요", points: 2 });
  }

  const subheadingCount = countOccurrences(result.body, /^##\s/m);
  if (subheadingCount < 3) {
    flags.push({ id: "fewSubheadings", label: `소제목이 ${subheadingCount}개뿐이에요 (3개 미만)`, points: 2 });
  }

  const hasStructuredElement =
    /\[\[TABLE:/.test(result.body) || /\[\[QUOTE:/.test(result.body) || /^\d+\.\s/m.test(result.body);
  if (!hasStructuredElement) {
    flags.push({ id: "noStructure", label: "표·인용구·번호목록 같은 구조화 요소가 하나도 없어요", points: 3 });
  }

  // 콘텐츠 품질 — 출처: moneyroan.com 체크리스트2
  if (!FIRST_PERSON_PATTERN.test(plainText)) {
    flags.push({ id: "noFirstPerson", label: "1인칭 경험·의견 표현이 전혀 없어요", points: 3 });
  }

  const duplicateSentences = countDuplicateSentences(plainText);
  if (duplicateSentences > 0) {
    flags.push({ id: "repeatedSentences", label: "같은 문장이 여러 번 반복돼요", points: 2 });
  }

  // 발행 방식 — 출처: moneyroan.com 체크리스트3("썸네일 없이 텍스트만 발행")
  const hasImageBlock = /\[\[(SLOT|GALLERY):\s*이미지/.test(result.body);
  if (result.recommendedThumbnail === 0 && !hasImageBlock) {
    flags.push({ id: "noThumbnail", label: "사진이 한 장도 없어요", points: 1 });
  }

  const linkCount = countOccurrences(result.body, /\[\[LINK:/);
  if (linkCount > 2) {
    flags.push({ id: "excessiveLinks", label: `외부 링크가 ${linkCount}개나 있어요 (2개 초과)`, points: 2 });
  }

  // 협찬 표기 — 이 프로젝트의 §16 공정위 표기 규칙과 직결된 체크. 출처:
  // catchdon.com/unsense.co.kr — 광고성인데 표기가 없는 경우를 위험 신호로 지목.
  if (sponsored) {
    const firstLine = plainText.slice(0, 80);
    if (!/(협찬|광고|제공받아|제공받)/.test(firstLine)) {
      flags.push({ id: "missingDisclosure", label: "협찬 글인데 본문 첫머리에 표기가 안 보여요", points: 3 });
    }
  }

  // 키워드 스팸 — 출처: unsense.co.kr "반복적 문구, 키워드 과다 삽입".
  // 태그 중 하나가 본문 길이 대비 비정상적으로 자주 등장하면 감점.
  for (const tag of result.tags) {
    if (tag.length < 2) continue;
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const occurrences = countOccurrences(plainText, new RegExp(escaped, "g"));
    const density = occurrences / Math.max(plainText.length / 300, 1); // 300자당 등장 횟수 기준
    if (occurrences >= 6 && density > 2) {
      flags.push({ id: `keywordStuffing-${tag}`, label: `"${tag}"가 본문에 ${occurrences}번이나 반복돼요`, points: 2 });
      break; // 여러 태그가 동시에 걸려도 한 번만 감점(중복 카운트 방지)
    }
  }

  // 홍보성 문구 밀도 + 고위험 업종 키워드 겹침 — 둘 다 있을 때만 감점(업종
  // 언급 자체는 자연스러울 수 있어서, 홍보 문구와 겹칠 때만 위험으로 봄).
  const promotionalHits = PROMOTIONAL_WORDS.filter((w) => plainText.includes(w)).length;
  if (promotionalHits >= 3 && HIGH_RISK_INDUSTRY_WORDS.test(plainText)) {
    flags.push({ id: "promotionalDensity", label: "홍보성 문구가 많고 규제가 엄격한 업종 키워드와 겹쳐요", points: 2 });
  }

  const totalPoints = flags.reduce((sum, f) => sum + f.points, 0);
  const level: LowQualityLevel = totalPoints >= 10 ? "높음" : totalPoints >= 5 ? "보통" : "낮음";

  return { totalPoints, level, flags };
}
