// Category metadata only — no fs access, so this is safe to import from the
// client-side form (src/components/write/BlogWriterForm.tsx). The actual
// rule-file content lookup (fs-based) lives in blogRules.ts, a server-only
// module, and keys off the same BlogCategory ids defined here.
export type BlogCategory =
  | "정보노하우형"
  | "리뷰후기형_내돈내산"
  | "리뷰후기형_협찬체험단"
  | "일상에세이형"
  | "홍보광고형";

export const BLOG_CATEGORIES: { id: BlogCategory; label: string; hint: string }[] = [
  { id: "정보노하우형", label: "정보·노하우형", hint: "지식 전달, 문제 해결 (~하는 법, ~정리)" },
  { id: "리뷰후기형_내돈내산", label: "리뷰·후기형 (내돈내산)", hint: "직접 구매한 제품·서비스 후기" },
  {
    id: "리뷰후기형_협찬체험단",
    label: "리뷰·후기형 (협찬·체험단)",
    hint: "제공받은 제품·서비스 후기 — 광고 표기 자동 반영",
  },
  { id: "일상에세이형", label: "일상·에세이형", hint: "일상·생각 기록, 정보보다 진정성·소통" },
  { id: "홍보광고형", label: "홍보·광고형", hint: "브랜드·업체 홍보 — 광고 표기 자동 반영" },
];

const CATEGORY_IDS = new Set<string>(BLOG_CATEGORIES.map((c) => c.id));

export function isBlogCategory(value: unknown): value is BlogCategory {
  return typeof value === "string" && CATEGORY_IDS.has(value);
}
