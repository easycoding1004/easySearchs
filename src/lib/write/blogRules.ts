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
const SPONSORSHIP_FILE = "블로그글쓰기규칙_협찬표기.md";
// 2026-08 추가(사용자 요청 — "저품질에 막히지 않도록 깊게 분석해서 md파일
// 정리") — C-Rank/D.I.A.(+) 판정 메커니즘 리서치를 바탕으로 한 심층 가이드.
// 개요와 마찬가지로 16개 유형 전부에 항상 포함됨(협찬표기와 달리 조건부
// 아님 — 저품질 방지는 모든 글에 해당하는 관심사라서).
const LOW_QUALITY_FILE = "블로그글쓰기규칙_저품질방지.md";

// 2026-08 v2 개편 — 4개 파일 → 16개 파일로 세분화(§CLAUDE.md 16.2). 파일명은
// blogCategories.ts의 id와 그대로 대응되게 지었음 — 새 유형을 추가할 때
// BLOG_CATEGORIES와 이 맵 양쪽에 등록할 것.
const RULE_FILES: Record<BlogCategory, string> = {
  정보노하우형_개념설명형: "블로그글쓰기규칙_정보노하우형_개념설명형.md",
  정보노하우형_튜토리얼따라하기형: "블로그글쓰기규칙_정보노하우형_튜토리얼따라하기형.md",
  정보노하우형_비교정리형: "블로그글쓰기규칙_정보노하우형_비교정리형.md",
  정보노하우형_QA형: "블로그글쓰기규칙_정보노하우형_QA형.md",
  리뷰후기형_수업특강후기형: "블로그글쓰기규칙_리뷰후기형_수업특강후기형.md",
  리뷰후기형_학생성과발표후기형: "블로그글쓰기규칙_리뷰후기형_학생성과발표후기형.md",
  리뷰후기형_교재도구리뷰형: "블로그글쓰기규칙_리뷰후기형_교재도구리뷰형.md",
  리뷰후기형_비교후기형: "블로그글쓰기규칙_리뷰후기형_비교후기형.md",
  일상에세이형_원장일기형: "블로그글쓰기규칙_일상에세이형_원장일기형.md",
  일상에세이형_수업브이로그형: "블로그글쓰기규칙_일상에세이형_수업브이로그형.md",
  일상에세이형_계절이벤트에세이형: "블로그글쓰기규칙_일상에세이형_계절이벤트에세이형.md",
  일상에세이형_생각인사이트공유형: "블로그글쓰기규칙_일상에세이형_생각인사이트공유형.md",
  홍보광고형_신규모집안내형: "블로그글쓰기규칙_홍보광고형_신규모집안내형.md",
  홍보광고형_커리큘럼소개형: "블로그글쓰기규칙_홍보광고형_커리큘럼소개형.md",
  홍보광고형_할인프로모션형: "블로그글쓰기규칙_홍보광고형_할인프로모션형.md",
  홍보광고형_행사설명회안내형: "블로그글쓰기규칙_홍보광고형_행사설명회안내형.md",
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
// 블록 마크업 공통 규칙) with the rules specific to the chosen category, so
// Claude gets both without the caller needing to know the overview exists.
export function getCategoryRuleText(category: BlogCategory): string {
  const overview = readRuleFile(OVERVIEW_FILE);
  const lowQuality = readRuleFile(LOW_QUALITY_FILE);
  const specific = readRuleFile(RULE_FILES[category]);
  return `${overview}\n\n---\n\n${lowQuality}\n\n---\n\n${specific}`;
}

// 협찬 여부는 16개 유형과 별개 축(§CLAUDE.md 16.2) — 사용자가 협찬 토글을
// 켰을 때만 이 텍스트를 시스템 프롬프트에 추가로 붙인다.
export function getSponsorshipRuleText(): string {
  return readRuleFile(SPONSORSHIP_FILE);
}
