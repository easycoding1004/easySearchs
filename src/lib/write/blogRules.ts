import fs from "node:fs";
import path from "node:path";
import type { BlogCategory } from "./blogCategories";

export type { BlogCategory } from "./blogCategories";
export { isBlogCategory } from "./blogCategories";

// Source of truth is new_blog/*.md (Korean writing-rule docs maintained outside
// src/ — see CLAUDE.md §0 folder note). Read at runtime instead of copy-pasting
// their content into TS so future edits to those files take effect without a
// code change. next.config.ts force-includes new_blog/** in the standalone
// trace (same pattern as garu-ko's wasm file) so this still works in the
// Docker/standalone deploy, not just `next dev`. Server-only module — do not
// import from client components (BlogWriterForm imports blogCategories.ts
// instead, which has no fs dependency).
const RULES_DIR = path.join(process.cwd(), "new_blog");
const OVERVIEW_FILE = "블로그글쓰기규칙_개요.md";

const RULE_FILES: Record<BlogCategory, string> = {
  정보노하우형: "블로그글쓰기규칙_정보노하우형.md",
  리뷰후기형_내돈내산: "블로그글쓰기규칙_리뷰후기형_내돈내산.md",
  리뷰후기형_협찬체험단: "블로그글쓰기규칙_리뷰후기형_협찬체험단.md",
  일상에세이형: "블로그글쓰기규칙_일상에세이형.md",
  홍보광고형: "블로그글쓰기규칙_홍보광고형.md",
};

const fileCache = new Map<string, string>();

function readRuleFile(filename: string): string {
  const cached = fileCache.get(filename);
  if (cached !== undefined) return cached;
  const content = fs.readFileSync(path.join(RULES_DIR, filename), "utf-8").trim();
  fileCache.set(filename, content);
  return content;
}

// Combines the shared cross-category rules (제목/글자수/이미지 공통 규칙 +
// C-Rank/D.I.A 참고) with the rules specific to the chosen category, so
// Claude gets both without the caller needing to know the overview exists.
export function getCategoryRuleText(category: BlogCategory): string {
  const overview = readRuleFile(OVERVIEW_FILE);
  const specific = readRuleFile(RULE_FILES[category]);
  return `${overview}\n\n---\n\n${specific}`;
}
