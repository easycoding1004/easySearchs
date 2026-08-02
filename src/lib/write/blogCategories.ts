// Category metadata only — no fs access, so this is safe to import from the
// client-side form (src/components/write/BlogWriterForm.tsx). The actual
// rule-file content lookup (fs-based) lives in blogRules.ts, a server-only
// module, and keys off the same BlogCategory ids defined here.
//
// 2026-08 v2 개편: 4대분류 → 16소분류로 세분화, 자동 분류(classifyCategory.ts,
// 삭제됨) 대신 사용자가 직접 고르는 방식으로 바뀜 — 선택 UI에서 이 메타데이터
// (특히 imageHint/videoHint/markupHint/sample)를 그대로 보여줘서 "이 유형을
// 고르면 뭐가 달라지는지" 알 수 있게 함. new_blog/블로그글쓰기규칙_개요.md의
// 표와 항상 일치시킬 것 — 여기서 값을 바꾸면 그 표도 같이 고칠 것.
//
// 2026-08 범용화(사용자 요청 — "학원에 맞춰져서 쓰는 형태가 되었는데, 범용
// 사용자가 작성한다고 생각하고 포맷을 수정해줘"): 초기 설계 때 예시로 쓴
// 학원(교습소) 맥락이 label/description에 그대로 남아있어서(원장 일기형,
// 수업 브이로그형, 학생 성과·발표 후기형 등) 카페·매장·스튜디오·프리랜서 등
// 어떤 업종에도 적용되는 문구로 다시 씀 — 내부 id(BlogCategory 값, 파일명)는
// 저장·마이그레이션 대상이 아니라(§16 "저장 없음") 그대로 둬도 무방해서 안
// 바꿈, 사용자에게 보이는 label/description/sample만 범용화함. `sample`도
// 이번에 새로 추가 — 유형 선택 시 오른쪽 미리보기 패널에 그대로 렌더링됨.
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
  sample: string; // 유형 선택 시 오른쪽에 보여줄 예시(제목·구조·마크업 한 줄)
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
    sample:
      '예시 제목: 스팀다리미 vs 일반다리미, 뭐가 다를까요?\n구조: 개념 정의 → 원리 설명 → 실생활 예시\n마크업 예시: [[QUOTE: "핵심은 압력이 아니라 온도 유지력이에요"]]',
  },
  {
    id: "정보노하우형_튜토리얼따라하기형",
    group: "정보노하우형",
    label: "튜토리얼·따라하기형",
    description: "단계별로 따라 하면 결과가 나오는 글 (설치, 실습, 신청 절차 등)",
    imageHint: "4~8장 (SLOT)",
    videoHint: "0~1",
    markupHint: "번호 리스트",
    sample:
      '예시 제목: 집에서 5분 만에 원두 그라인더 청소하는 법\n구조: 준비물 → 1단계~4단계 순서대로 → 완성 확인\n마크업 예시: [[SLOT: 이미지 | 개수=1 | 역할=1단계 | 사진=1 | 힌트="분해 순서"]]',
  },
  {
    id: "정보노하우형_비교정리형",
    group: "정보노하우형",
    label: "비교·정리형",
    description: "여러 선택지·정보를 표로 한눈에 비교·정리하는 글",
    imageHint: "2~4장",
    videoHint: "-",
    markupHint: "TABLE",
    sample:
      '예시 제목: 왁싱 vs 제모크림, 3가지 기준으로 비교했어요\n구조: 비교 기준 소개 → 표로 정리 → 결론\n마크업 예시: [[TABLE: 헤더="기준,왁싱,제모크림" | 행1="지속력,3주,3일"]]',
  },
  {
    id: "정보노하우형_QA형",
    group: "정보노하우형",
    label: "Q&A·FAQ형",
    description: "자주 묻는 질문을 모아 답하는 글",
    imageHint: "1~3장",
    videoHint: "-",
    markupHint: "QUOTE(질문 강조)",
    sample:
      '예시 제목: 손님들이 가장 많이 묻는 질문 5가지\n구조: 질문 1~5를 각각 소제목으로 → 두괄식 답변\n마크업 예시: [[QUOTE: "예약 취소는 언제까지 가능한가요?"]]',
  },
  {
    id: "리뷰후기형_수업특강후기형",
    group: "리뷰후기형",
    label: "클래스·서비스 후기형",
    description: "진행한 클래스·강의·시술·상담 같은 서비스가 어땠는지 현장감 있게 소개하는 글",
    imageHint: "8~15장",
    videoHint: "1",
    markupHint: "GALLERY",
    sample:
      '예시 제목: 처음 받아본 원데이 도자기 클래스, 이랬어요\n구조: 신청 계기 → 진행 과정·분위기 → 특징 → 아쉬운 점\n마크업 예시: [[GALLERY: 이미지 | 개수=6 | 배치=그리드 | 사진=1-6 | 힌트="진행 과정"]]',
  },
  {
    id: "리뷰후기형_학생성과발표후기형",
    group: "리뷰후기형",
    label: "고객 성과·후기 소개형",
    description: "고객이 얻은 성과(변화·결과·수상 등)를 소개하는 글",
    imageHint: "6~12장",
    videoHint: "1~2",
    markupHint: "GALLERY, QUOTE",
    sample:
      '예시 제목: 3개월 PT 후 이렇게 달라진 고객님 후기\n구조: 시작 계기 → 과정·어려웠던 점 → 결과 → 고객 소감 인용\n마크업 예시: [[QUOTE: "처음엔 반신반의했는데 정말 달라졌어요"]]',
  },
  {
    id: "리뷰후기형_교재도구리뷰형",
    group: "리뷰후기형",
    label: "제품·도구 리뷰형",
    description: "업무·매장 운영에 쓰는 제품·프로그램·도구를 소개·평가하는 글",
    imageHint: "4~8장",
    videoHint: "0~1",
    markupHint: "TABLE(스펙 비교)",
    sample:
      '예시 제목: 매장에서 반년 써본 커피머신, 솔직 후기\n구조: 도입 배경 → 장단점 → 총평·추천 대상\n마크업 예시: [[TABLE: 헤더="항목,이전 제품,새 제품" | 행1="속도,느림,빠름"]]',
  },
  {
    id: "리뷰후기형_비교후기형",
    group: "리뷰후기형",
    label: "비교 후기형",
    description: "두 가지 이상을 실제 경험 기준으로 비교하는 후기",
    imageHint: "4~6장",
    videoHint: "-",
    markupHint: "TABLE",
    sample:
      '예시 제목: A매장 vs B매장, 직접 가서 비교해봤어요\n구조: 비교 포인트 소개 → 표로 비교 → 최종 선택\n마크업 예시: [[TABLE: 헤더="기준,A,B" | 행1="가격,15000원,18000원"]]',
  },
  {
    id: "일상에세이형_원장일기형",
    group: "일상에세이형",
    label: "운영자 일기형",
    description: "매장·가게를 운영하는 사람 개인의 하루·생각을 기록하는 글",
    imageHint: "1~3장",
    videoHint: "-",
    markupHint: "QUOTE",
    sample:
      '예시 제목: 오늘따라 유난히 바빴던 하루\n구조: 오늘 있었던 일 → 느낀 점\n마크업 예시: [[QUOTE: "손이 열 개라도 모자란 날이었어요"]]',
  },
  {
    id: "일상에세이형_수업브이로그형",
    group: "일상에세이형",
    label: "현장 브이로그형",
    description: "하루 업무·영업 전체를 사진·영상 위주로 기록하는 글 (이미지 개수가 가장 많은 유형)",
    imageHint: "20~50장 (GALLERY)",
    videoHint: "0~1",
    markupHint: "GALLERY",
    sample:
      '예시 제목: 오픈부터 마감까지, 매장의 하루\n구조: 오픈 준비 → 영업 중 순간들 → 마감\n마크업 예시: [[GALLERY: 이미지 | 개수=20 | 배치=그리드 | 사진=1-20]]',
  },
  {
    id: "일상에세이형_계절이벤트에세이형",
    group: "일상에세이형",
    label: "계절·이벤트 에세이형",
    description: "계절 변화, 명절, 가게 이벤트를 계기로 쓰는 에세이",
    imageHint: "3~6장",
    videoHint: "-",
    markupHint: "DIVIDER",
    sample: '예시 제목: 첫눈 오던 날, 매장 풍경\n구조: 계절 계기 소개 → 그날 있었던 일 → 마무리 소감\n마크업 예시: [[DIVIDER]]',
  },
  {
    id: "일상에세이형_생각인사이트공유형",
    group: "일상에세이형",
    label: "생각·인사이트 공유형",
    description: "하는 일이나 손님을 대하며 평소 느낀 생각을 공유하는 글",
    imageHint: "1~2장",
    videoHint: "-",
    markupHint: "QUOTE",
    sample: '예시 제목: 손님을 오래 대하면서 느낀 것\n구조: 평소 느낀 생각 → 이유·경험\n마크업 예시: [[QUOTE: "결국 진심은 통하더라고요"]]',
  },
  {
    id: "홍보광고형_신규모집안내형",
    group: "홍보광고형",
    label: "신규 고객·회원 모집형",
    description: "신규 고객·회원을 모집하는 글",
    imageHint: "3~6장",
    videoHint: "1",
    markupHint: "LINK, PLACE",
    sample: '예시 제목: 이번 달 신규 회원 혜택 안내\n구조: 공감 포인트 → 모집 대상·혜택 → 신청 CTA\n마크업 예시: [[LINK: url="..." | 설명="신청하기"]]',
  },
  {
    id: "홍보광고형_커리큘럼소개형",
    group: "홍보광고형",
    label: "상품·서비스 소개형",
    description: "판매하는 상품 라인업이나 제공하는 서비스 구성을 자세히 소개하는 글",
    imageHint: "4~8장",
    videoHint: "0~1",
    markupHint: "TABLE",
    sample: '예시 제목: 저희 매장 시그니처 메뉴 구성을 소개합니다\n구조: 고민 제시 → 구성을 표로 정리 → 상세 설명\n마크업 예시: [[TABLE: 헤더="구성,설명,가격"]]',
  },
  {
    id: "홍보광고형_할인프로모션형",
    group: "홍보광고형",
    label: "할인·프로모션형",
    description: "할인·이벤트 프로모션을 안내하는 글",
    imageHint: "2~4장",
    videoHint: "0~1",
    markupHint: "QUOTE, LINK",
    sample: '예시 제목: 이번 주말 한정 20% 할인 진행합니다\n구조: 프로모션 요약 → 대상·기간 → 신청 방법\n마크업 예시: [[QUOTE: "이번 주말에만 드리는 혜택이에요"]]',
  },
  {
    id: "홍보광고형_행사설명회안내형",
    group: "홍보광고형",
    label: "행사·설명회 안내형",
    description: "설명회·오픈 행사 같은 오프라인 행사를 안내하는 글",
    imageHint: "5~15장 (GALLERY 가능)",
    videoHint: "1",
    markupHint: "PLACE, LINK, GALLERY",
    sample: '예시 제목: OO 오픈 기념 설명회에 초대합니다\n구조: 행사 핵심 요약 → 프로그램 상세 → 참석 신청\n마크업 예시: [[PLACE: 이름="OO스튜디오 2층"]]',
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
