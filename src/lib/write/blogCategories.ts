// Category metadata only — no fs access, so this is safe to import from the
// client-side form (src/components/write/BlogWriterForm.tsx). The actual
// rule-file content lookup (fs-based) lives in blogRules.ts, a server-only
// module, and keys off the same BlogCategory ids defined here.
//
// 2026-08 v2 개편: 4대분류 → 16소분류로 세분화, 자동 분류(classifyCategory.ts,
// 삭제됨) 대신 사용자가 직접 고르는 방식으로 바뀜 — 선택 UI에서 이 메타데이터
// (특히 imageHint/videoHint/markupHint)를 그대로 보여줘서 "이 유형을 고르면
// 뭐가 달라지는지" 알 수 있게 함. new_blog/블로그글쓰기규칙_개요.md의 표와
// 항상 일치시킬 것 — 여기서 값을 바꾸면 그 표도 같이 고칠 것.
export type BlogGroup = "정보노하우형" | "리뷰후기형" | "일상에세이형" | "홍보광고형";

export type BlogCategory =
  | "정보노하우형_개념설명형"
  | "정보노하우형_튜토리얼따라하기형"
  | "정보노하우형_비교정리형"
  | "정보노하우형_QA형"
  | "리뷰후기형_수업특강후기형"
  | "리뷰후기형_학생성과발표후기형"
  | "리뷰후기형_교재도구리뷰형"
  | "리뷰후기형_비교후기형"
  | "일상에세이형_원장일기형"
  | "일상에세이형_수업브이로그형"
  | "일상에세이형_계절이벤트에세이형"
  | "일상에세이형_생각인사이트공유형"
  | "홍보광고형_신규모집안내형"
  | "홍보광고형_커리큘럼소개형"
  | "홍보광고형_할인프로모션형"
  | "홍보광고형_행사설명회안내형";

export interface BlogCategoryMeta {
  id: BlogCategory;
  group: BlogGroup;
  label: string; // 소분류 이름
  description: string; // 유형 선택 시 보여줄 한 줄 설명
  imageHint: string; // 이미지 권장 개수(문서 표 그대로)
  videoHint: string; // 영상 권장 개수
  markupHint: string; // 특징 마크업
}

export const BLOG_GROUPS: { id: BlogGroup; label: string }[] = [
  { id: "정보노하우형", label: "정보·노하우형" },
  { id: "리뷰후기형", label: "리뷰·후기형" },
  { id: "일상에세이형", label: "일상·에세이형" },
  { id: "홍보광고형", label: "홍보·광고형" },
];

export const BLOG_CATEGORIES: BlogCategoryMeta[] = [
  {
    id: "정보노하우형_개념설명형",
    group: "정보노하우형",
    label: "개념 설명형",
    description: '"OO이란", "OO 원리"처럼 개념·용어를 쉽게 풀어 설명하는 글',
    imageHint: "2~4장",
    videoHint: "-",
    markupHint: "QUOTE, DIVIDER",
  },
  {
    id: "정보노하우형_튜토리얼따라하기형",
    group: "정보노하우형",
    label: "튜토리얼·따라하기형",
    description: "단계별로 따라 하면 결과가 나오는 글 (설치, 실습, 신청 절차 등)",
    imageHint: "4~8장 (SLOT)",
    videoHint: "0~1",
    markupHint: "번호 리스트",
  },
  {
    id: "정보노하우형_비교정리형",
    group: "정보노하우형",
    label: "비교·정리형",
    description: "여러 선택지·정보를 표로 한눈에 비교·정리하는 글",
    imageHint: "2~4장",
    videoHint: "-",
    markupHint: "TABLE",
  },
  {
    id: "정보노하우형_QA형",
    group: "정보노하우형",
    label: "Q&A·FAQ형",
    description: "자주 묻는 질문을 모아 답하는 글",
    imageHint: "1~3장",
    videoHint: "-",
    markupHint: "QUOTE(질문 강조)",
  },
  {
    id: "리뷰후기형_수업특강후기형",
    group: "리뷰후기형",
    label: "수업·특강 후기형",
    description: "진행한 수업·특강이 어땠는지 현장감 있게 소개하는 글",
    imageHint: "8~15장",
    videoHint: "1",
    markupHint: "GALLERY",
  },
  {
    id: "리뷰후기형_학생성과발표후기형",
    group: "리뷰후기형",
    label: "학생 성과·발표 후기형",
    description: "학생의 성과(대회 수상, 발표 등)를 소개하는 글",
    imageHint: "6~12장",
    videoHint: "1~2",
    markupHint: "GALLERY, QUOTE",
  },
  {
    id: "리뷰후기형_교재도구리뷰형",
    group: "리뷰후기형",
    label: "교재·도구 리뷰형",
    description: "수업에 쓰는 교재·프로그램·도구를 소개·평가하는 글",
    imageHint: "4~8장",
    videoHint: "0~1",
    markupHint: "TABLE(스펙 비교)",
  },
  {
    id: "리뷰후기형_비교후기형",
    group: "리뷰후기형",
    label: "비교 후기형",
    description: "두 가지 이상을 실제 경험 기준으로 비교하는 후기",
    imageHint: "4~6장",
    videoHint: "-",
    markupHint: "TABLE",
  },
  {
    id: "일상에세이형_원장일기형",
    group: "일상에세이형",
    label: "원장 일기형",
    description: "원장(운영자) 개인의 하루·생각을 기록하는 글",
    imageHint: "1~3장",
    videoHint: "-",
    markupHint: "QUOTE",
  },
  {
    id: "일상에세이형_수업브이로그형",
    group: "일상에세이형",
    label: "수업 브이로그형",
    description: "하루 수업 전체를 사진·영상 위주로 기록하는 글 (이미지 개수가 가장 많은 유형)",
    imageHint: "20~50장 (GALLERY)",
    videoHint: "0~1",
    markupHint: "GALLERY",
  },
  {
    id: "일상에세이형_계절이벤트에세이형",
    group: "일상에세이형",
    label: "계절·이벤트 에세이형",
    description: "계절 변화, 명절, 학원 이벤트를 계기로 쓰는 에세이",
    imageHint: "3~6장",
    videoHint: "-",
    markupHint: "DIVIDER",
  },
  {
    id: "일상에세이형_생각인사이트공유형",
    group: "일상에세이형",
    label: "생각·인사이트 공유형",
    description: "교육이나 아이들에 대해 평소 느낀 생각을 공유하는 글",
    imageHint: "1~2장",
    videoHint: "-",
    markupHint: "QUOTE",
  },
  {
    id: "홍보광고형_신규모집안내형",
    group: "홍보광고형",
    label: "신규 모집 안내형",
    description: "신규 수강생·회원을 모집하는 글",
    imageHint: "3~6장",
    videoHint: "1",
    markupHint: "LINK, PLACE",
  },
  {
    id: "홍보광고형_커리큘럼소개형",
    group: "홍보광고형",
    label: "커리큘럼 소개형",
    description: "학원·수업의 커리큘럼을 자세히 소개하는 글",
    imageHint: "4~8장",
    videoHint: "0~1",
    markupHint: "TABLE",
  },
  {
    id: "홍보광고형_할인프로모션형",
    group: "홍보광고형",
    label: "할인·프로모션형",
    description: "할인·이벤트 프로모션을 안내하는 글",
    imageHint: "2~4장",
    videoHint: "0~1",
    markupHint: "QUOTE, LINK",
  },
  {
    id: "홍보광고형_행사설명회안내형",
    group: "홍보광고형",
    label: "행사·설명회 안내형",
    description: "설명회·입학 상담회 같은 오프라인 행사를 안내하는 글",
    imageHint: "5~15장 (GALLERY 가능)",
    videoHint: "1",
    markupHint: "PLACE, LINK, GALLERY",
  },
];

const CATEGORY_IDS = new Set<string>(BLOG_CATEGORIES.map((c) => c.id));

export function isBlogCategory(value: unknown): value is BlogCategory {
  return typeof value === "string" && CATEGORY_IDS.has(value);
}

export function getBlogCategoryMeta(id: BlogCategory): BlogCategoryMeta {
  const meta = BLOG_CATEGORIES.find((c) => c.id === id);
  if (!meta) throw new Error(`Unknown blog category: ${id}`);
  return meta;
}
