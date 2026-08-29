// 2026-08 추가("내 블로그 유형 진단", 사용자 요청 — "블로그 제작자(프리랜서,
// 자영업자)를 위한 노는 볼거리와 문화를 만들고 싶다" + "자동화되는 콘텐츠").
// AI 호출 없이 순수 규칙 기반(4문항 → 4유형)이라 비용이 전혀 안 들고, 아무리
// 많이 공유돼도 부담이 없음 — §16의 AI 글쓰기 16개 카테고리(fs 없는
// blogCategories.ts, 클라이언트 안전)를 그대로 재사용해서 "이 유형엔 이런
// 글감이 있어요"까지 자연스럽게 이어지도록 함. 새 타입/색상 체계를 발명하지
// 않고 이미 검증된 4대분류(정보노하우형/리뷰후기형/일상에세이형/홍보광고형)를
// 그대로 결과로 씀.
import { BLOG_CATEGORIES, type BlogCategoryMeta, type BlogGroup } from "@/lib/write/blogCategories";

export interface QuizOption {
  label: string;
  group: BlogGroup;
}

export interface QuizQuestion {
  question: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: "요즘 손님·고객에게 가장 많이 듣는 질문은?",
    options: [
      { label: "\"이게 정확히 어떻게 다른 거예요?\"", group: "정보노하우형" },
      { label: "\"다른 곳도 가봤는데, 여기는 어때요?\"", group: "리뷰후기형" },
      { label: "\"사장님은 요즘 어떻게 지내세요?\"", group: "일상에세이형" },
      { label: "\"신메뉴(신상품)는 언제 나와요?\"", group: "홍보광고형" },
    ],
  },
  {
    question: "블로그를 쓰고 싶은 진짜 이유는?",
    options: [
      { label: "내가 아는 노하우를 나누고 싶어서", group: "정보노하우형" },
      { label: "이용해주신 분들의 후기를 보여주고 싶어서", group: "리뷰후기형" },
      { label: "그냥 오늘 하루, 내 이야기를 기록하고 싶어서", group: "일상에세이형" },
      { label: "신규 손님을 더 모으고 싶어서", group: "홍보광고형" },
    ],
  },
  {
    question: "SNS에서 저장해두고 싶은 글은 어떤 스타일인가요?",
    options: [
      { label: "표나 체크리스트로 깔끔하게 정리된 글", group: "정보노하우형" },
      { label: "사진이 가득한 생생한 현장 후기", group: "리뷰후기형" },
      { label: "솔직한 감정이 담긴 짧은 에세이", group: "일상에세이형" },
      { label: "눈길을 끄는 할인·이벤트 소식", group: "홍보광고형" },
    ],
  },
  {
    question: "요즘 내 블로그를 보면 가장 아쉬운 점은?",
    options: [
      { label: "우리 업종에 대한 정보가 부족해 보여요", group: "정보노하우형" },
      { label: "이용해주신 분들의 후기가 더 필요해요", group: "리뷰후기형" },
      { label: "너무 사무적으로만 보이는 것 같아요", group: "일상에세이형" },
      { label: "신규 손님 유입이 부족해요", group: "홍보광고형" },
    ],
  },
];

export interface GroupResultMeta {
  emoji: string;
  headline: string;
  description: string;
}

export const GROUP_RESULTS: Record<BlogGroup, GroupResultMeta> = {
  정보노하우형: {
    emoji: "📚",
    headline: "정보·노하우형 블로거",
    description:
      '"이건 이렇게 하는 거예요" — 아는 걸 나눌 때 가장 신나는 타입이에요. 검색해서 찾아오는, 오래 남는 글을 잘 쓰는 편이에요.',
  },
  리뷰후기형: {
    emoji: "⭐",
    headline: "리뷰·후기형 블로거",
    description: "현장의 생생함을 담는 데 진심인 타입이에요. 사진과 이야기로 신뢰를 쌓는 글이 강점이에요.",
  },
  일상에세이형: {
    emoji: "☕",
    headline: "일상·에세이형 블로거",
    description: "숫자보다 사람 냄새 나는 이야기를 좋아하는 타입이에요. 진심이 전해지는 글로 단골을 만드는 편이에요.",
  },
  홍보광고형: {
    emoji: "📣",
    headline: "홍보·광고형 블로거",
    description: "기회를 놓치지 않고 알리는 데 능한 타입이에요. 이벤트·소식을 임팩트 있게 전달하는 글이 강점이에요.",
  },
};

// 2026-08 유입 전략(바이럴 장치) — 결과별 공유 전용 URL(/blog-type/result/
// [slug])용 ASCII 슬러그. 한글 그룹명을 URL에 그대로 쓰면 공유 시 퍼센트
// 인코딩된 긴 주소가 돼서 지저분함.
export const GROUP_SLUGS: Record<BlogGroup, string> = {
  정보노하우형: "info",
  리뷰후기형: "review",
  일상에세이형: "essay",
  홍보광고형: "promo",
};

export function groupFromSlug(slug: string): BlogGroup | null {
  const found = (Object.entries(GROUP_SLUGS) as [BlogGroup, string][]).find(
    ([, s]) => s === slug
  );
  return found ? found[0] : null;
}

// 같은 그룹이 여러 번 나오면 그 그룹이 결과 — 동점이면 먼저 나온(=먼저
// 답한) 그룹을 우선함(Map 순회 순서가 삽입 순서라 자연히 그렇게 됨).
export function computeResultGroup(answers: BlogGroup[]): BlogGroup {
  const counts = new Map<BlogGroup, number>();
  for (const g of answers) counts.set(g, (counts.get(g) ?? 0) + 1);
  let best = answers[0];
  let bestCount = 0;
  for (const [group, count] of counts) {
    if (count > bestCount) {
      best = group;
      bestCount = count;
    }
  }
  return best;
}

export function getCategoriesForGroup(group: BlogGroup): BlogCategoryMeta[] {
  return BLOG_CATEGORIES.filter((c) => c.group === group);
}
