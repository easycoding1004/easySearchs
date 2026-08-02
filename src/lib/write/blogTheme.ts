import type { BlogCategory } from "./blogCategories";

// 2026-08 추가(사용자 요청 — "네이버 상위 조회수 블로그 게시물들의 여러 타입을
// 내용에 따라 선택해서 디자인에 인용해달라"): 결과물(미리보기 화면 + "서식
// 포함 복사"/"확장으로 보내기"로 실제 네이버에 붙여넣는 HTML)의 색상·소제목
// 장식·인용구 스타일·목록 마커·폰트를 16개 유형마다 다르게 적용한다 —
// 실제 특정 블로그를 스크래핑/인용한 게 아니라(§10.4 원칙상 새 스크래핑은
// 승인 필요, 이번엔 안 함) "정보형은 깔끔한 파랑 계열, 리뷰형은 따뜻한
// 세리프 헤딩, 에세이형은 차분한 무드, 홍보형은 굵고 채도 높은 CTA톤" 같은
// 일반적인 한국 블로그 타이포그래피·톤 관행 지식을 적용한 것(§16 "소제목·
// 목록 스타일 다양화" 항목과 같은 원칙).
//
// 클라이언트/서버 양쪽에서 안전하게 import 가능(fs 없음) — BlogWriterForm.tsx
// (React 미리보기)와 parseBody.ts(HTML 문자열 렌더러) 둘 다 이 값을 그대로
// 씀. 폰트는 웹폰트 없이(네이버 붙여넣기가 외부 리소스를 못 불러오므로) 시스템
// 폰트 스택만 사용 — headingFont가 bodyFont와 다르면 그 폰트가 설치돼 있는
// 기기에서만 차이가 보이고, 없으면 각자의 기본 sans/serif로 자연스럽게
// 폴백된다.
const SANS_STACK = "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const SERIF_STACK = "'Nanum Myeongjo', 'Noto Serif KR', serif";
const ROUNDED_STACK = "'Nanum Gothic', 'Malgun Gothic', sans-serif";
const HANDWRITING_STACK = "'Nanum Pen Script', 'Gaegu', cursive";
const IMPACT_STACK = "'Black Han Sans', 'Malgun Gothic', sans-serif";

export type HeadingStyle = "underline" | "boxed" | "sideBar" | "plain";
export type QuoteStyle = "border" | "serif" | "highlight";
export type ListMarker = "circle" | "arrow" | "dash" | "check";
export type EmphasisStyle = "highlight" | "underline-accent";

export interface BlogTheme {
  accent: string; // 강조색(진한 톤) — 소제목·인용구·표 테두리 등
  accentSoft: string; // accent의 옅은 톤 — 배경 하이라이트용
  bodyFont: string;
  headingFont: string;
  headingStyle: HeadingStyle;
  headingSize: number; // px
  quoteStyle: QuoteStyle;
  listMarker: ListMarker;
  lineHeight: number;
  emphasisStyle: EmphasisStyle;
}

export const BLOG_THEMES: Record<BlogCategory, BlogTheme> = {
  // 정보·노하우형 — 신뢰감 있는 블루·틸 계열, 깔끔한 산세리프, 여백 넉넉
  정보노하우형_개념설명형: {
    accent: "#2563eb",
    accentSoft: "#dbeafe",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "underline",
    headingSize: 20,
    quoteStyle: "serif",
    listMarker: "dash",
    lineHeight: 1.85,
    emphasisStyle: "highlight",
  },
  정보노하우형_튜토리얼따라하기형: {
    accent: "#0891b2",
    accentSoft: "#cffafe",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "sideBar",
    headingSize: 19,
    quoteStyle: "border",
    listMarker: "circle",
    lineHeight: 1.75,
    emphasisStyle: "highlight",
  },
  정보노하우형_비교정리형: {
    accent: "#4338ca",
    accentSoft: "#e0e7ff",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "boxed",
    headingSize: 19,
    quoteStyle: "border",
    listMarker: "dash",
    lineHeight: 1.75,
    emphasisStyle: "highlight",
  },
  정보노하우형_QA형: {
    accent: "#0d9488",
    accentSoft: "#ccfbf1",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "plain",
    headingSize: 20,
    quoteStyle: "highlight",
    listMarker: "dash",
    lineHeight: 1.85,
    emphasisStyle: "highlight",
  },

  // 리뷰·후기형 — 따뜻한 코랄·앰버 계열, 소제목은 세리프로 신뢰감·진정성
  리뷰후기형_수업특강후기형: {
    accent: "#ea580c",
    accentSoft: "#ffedd5",
    bodyFont: SANS_STACK,
    headingFont: SERIF_STACK,
    headingStyle: "underline",
    headingSize: 20,
    quoteStyle: "serif",
    listMarker: "arrow",
    lineHeight: 1.8,
    emphasisStyle: "highlight",
  },
  리뷰후기형_학생성과발표후기형: {
    accent: "#db2777",
    accentSoft: "#fce7f3",
    bodyFont: SANS_STACK,
    headingFont: SERIF_STACK,
    headingStyle: "sideBar",
    headingSize: 20,
    quoteStyle: "serif",
    listMarker: "arrow",
    lineHeight: 1.8,
    emphasisStyle: "highlight",
  },
  리뷰후기형_교재도구리뷰형: {
    accent: "#b45309",
    accentSoft: "#fef3c7",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "boxed",
    headingSize: 19,
    quoteStyle: "border",
    listMarker: "dash",
    lineHeight: 1.75,
    emphasisStyle: "highlight",
  },
  리뷰후기형_비교후기형: {
    accent: "#c2410c",
    accentSoft: "#fed7aa",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "underline",
    headingSize: 19,
    quoteStyle: "border",
    listMarker: "dash",
    lineHeight: 1.75,
    emphasisStyle: "highlight",
  },

  // 일상·에세이형 — 차분하고 톤다운된 색, 세리프 소제목으로 정서적 무드,
  // 줄간격을 가장 넉넉하게(읽는 속도보다 여백감이 중요한 장르)
  일상에세이형_원장일기형: {
    accent: "#92400e",
    accentSoft: "#fef3e2",
    bodyFont: SANS_STACK,
    headingFont: SERIF_STACK,
    headingStyle: "plain",
    headingSize: 20,
    quoteStyle: "serif",
    listMarker: "dash",
    lineHeight: 1.95,
    emphasisStyle: "underline-accent",
  },
  일상에세이형_수업브이로그형: {
    accent: "#15803d",
    accentSoft: "#dcfce7",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "underline",
    headingSize: 19,
    quoteStyle: "border",
    listMarker: "arrow",
    lineHeight: 1.75,
    emphasisStyle: "highlight",
  },
  일상에세이형_계절이벤트에세이형: {
    accent: "#be185d",
    accentSoft: "#fce7f3",
    bodyFont: SANS_STACK,
    headingFont: SERIF_STACK,
    headingStyle: "plain",
    headingSize: 20,
    quoteStyle: "serif",
    listMarker: "dash",
    lineHeight: 1.95,
    emphasisStyle: "underline-accent",
  },
  일상에세이형_생각인사이트공유형: {
    accent: "#475569",
    accentSoft: "#f1f5f9",
    bodyFont: SANS_STACK,
    headingFont: SERIF_STACK,
    headingStyle: "sideBar",
    headingSize: 20,
    quoteStyle: "serif",
    listMarker: "dash",
    lineHeight: 1.95,
    emphasisStyle: "underline-accent",
  },

  // 홍보·광고형 — 채도 높고 굵은 톤, 박스형 소제목·강조로 시선 유도,
  // 줄간격은 가장 촘촘하게(설득력 있게 몰아붙이는 리듬)
  홍보광고형_신규모집안내형: {
    accent: "#dc2626",
    accentSoft: "#fee2e2",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "boxed",
    headingSize: 21,
    quoteStyle: "highlight",
    listMarker: "check",
    lineHeight: 1.7,
    emphasisStyle: "highlight",
  },
  홍보광고형_커리큘럼소개형: {
    accent: "#7c3aed",
    accentSoft: "#ede9fe",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "boxed",
    headingSize: 20,
    quoteStyle: "border",
    listMarker: "dash",
    lineHeight: 1.7,
    emphasisStyle: "highlight",
  },
  홍보광고형_할인프로모션형: {
    accent: "#e11d48",
    accentSoft: "#ffe4e6",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "boxed",
    headingSize: 21,
    quoteStyle: "highlight",
    listMarker: "check",
    lineHeight: 1.65,
    emphasisStyle: "highlight",
  },
  홍보광고형_행사설명회안내형: {
    accent: "#0369a1",
    accentSoft: "#e0f2fe",
    bodyFont: SANS_STACK,
    headingFont: SANS_STACK,
    headingStyle: "sideBar",
    headingSize: 20,
    quoteStyle: "border",
    listMarker: "check",
    lineHeight: 1.75,
    emphasisStyle: "highlight",
  },
};

export function getBlogTheme(category: BlogCategory): BlogTheme {
  return BLOG_THEMES[category];
}

// 2026-08 추가(사용자 요청 — "16가지 유형 선택과 별개로 색깔·글꼴을 선택
// 사항으로 추가해달라") — 16개 유형은 각자 어울리는 색/폰트가 자동으로
// 정해지지만, 사용자가 원하면 그 위에 색상·폰트만 따로 바꿀 수 있게 함.
// 프리셋은 16개 테마에서 이미 쓰인 색상들 중 대표적인 것들을 모음(새 색을
// 발명하지 않고 검증된 팔레트 재사용) — "직접 입력"은 UI에서 <input
// type="color">로 별도 처리.
export const ACCENT_PRESETS: { label: string; value: string }[] = [
  { label: "블루", value: "#2563eb" },
  { label: "네이비", value: "#1e3a8a" },
  { label: "스카이", value: "#0369a1" },
  { label: "틸", value: "#0d9488" },
  { label: "민트", value: "#059669" },
  { label: "그린", value: "#15803d" },
  { label: "라임", value: "#65a30d" },
  { label: "올리브", value: "#4d7c0f" },
  { label: "머스타드", value: "#ca8a04" },
  { label: "앰버", value: "#b45309" },
  { label: "브라운", value: "#78350f" },
  { label: "코랄", value: "#ea580c" },
  { label: "피치", value: "#f97316" },
  { label: "레드", value: "#dc2626" },
  { label: "로즈", value: "#e11d48" },
  { label: "핑크", value: "#db2777" },
  { label: "마젠타", value: "#c026d3" },
  { label: "바이올렛", value: "#7c3aed" },
  { label: "라벤더", value: "#8b5cf6" },
  { label: "인디고", value: "#4338ca" },
  { label: "슬레이트", value: "#475569" },
  { label: "차콜", value: "#1f2937" },
];

// 2026-08 확대(사용자 요청 — "글 폰트 종류는 더 많았으면 해") — 처음엔
// 산세리프/세리프 2종뿐이었는데, 둥근 고딕(친근한 느낌)·손글씨풍(캐주얼한
// 에세이 느낌)·굵은 임팩트(홍보·CTA 느낌)를 추가함. 뒤 세 개는 대부분
// 기기에 기본 설치돼 있지 않은 폰트라(웹폰트 로딩 불가 제약은 위 주석 참고)
// 그 폰트가 실제로 깔려 있는 기기에서만 의도한 모양이 보이고, 없으면
// 각자의 대체 키워드(sans-serif/cursive)로 자연스럽게 폴백됨 — 이 폴백
// 특성은 UI에서 사용자에게 짧게 안내함.
export type FontChoice = "sans" | "serif" | "rounded" | "handwriting" | "impact";
export const FONT_OPTIONS: { label: string; value: FontChoice; stack: string }[] = [
  { label: "깔끔한 산세리프", value: "sans", stack: SANS_STACK },
  { label: "부드러운 세리프", value: "serif", stack: SERIF_STACK },
  { label: "둥근 고딕", value: "rounded", stack: ROUNDED_STACK },
  { label: "손글씨풍", value: "handwriting", stack: HANDWRITING_STACK },
  { label: "굵은 임팩트", value: "impact", stack: IMPACT_STACK },
];

// hex(#rrggbb)를 흰색과 섞어 옅은 배경 톤을 만든다 — 16개 사전 정의 테마는
// accent/accentSoft를 손으로 직접 짝지어뒀지만, 사용자가 직접 고른 임의의
// accent 색상은 accentSoft를 실시간으로 계산해야 어울리는 배경 톤이 나옴.
export function lightenHex(hex: string, ratio = 0.85): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const num = parseInt(match[1], 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * ratio);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export interface ThemeOverrides {
  accent?: string | null; // hex — null/undefined이면 유형 기본 색상 사용
  font?: FontChoice | null; // null/undefined이면 유형 기본 폰트 사용
}

// 유형 기본 테마 위에 사용자가 고른 색상·폰트를 얹는다 — 유형별 헤딩
// 스타일/인용구 스타일/목록 마커 등 "구조"는 그대로 유지하고 색·폰트만
// 바뀌므로, 유형 특유의 개성은 남으면서 색감만 취향대로 바뀜.
export function applyThemeOverrides(base: BlogTheme, overrides: ThemeOverrides): BlogTheme {
  const theme = { ...base };
  if (overrides.accent) {
    theme.accent = overrides.accent;
    theme.accentSoft = lightenHex(overrides.accent);
  }
  if (overrides.font) {
    const stack = FONT_OPTIONS.find((f) => f.value === overrides.font)?.stack;
    if (stack) {
      theme.bodyFont = stack;
      theme.headingFont = stack;
    }
  }
  return theme;
}
