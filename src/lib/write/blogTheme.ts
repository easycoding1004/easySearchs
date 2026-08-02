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
