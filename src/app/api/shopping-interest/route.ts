import { NextResponse } from "next/server";
import { matchShoppingCategory, getCategoryShoppingDirection } from "@/lib/naver/categoryShoppingTrend";
import { CATEGORY_CID_MAP } from "@/lib/naver/datalabCategories";
import type { TrendDirection } from "@/lib/naver/trendDirection";

// 개인 도구(/result) 결과 페이지의 시드 키워드에서만 호출 — 사용자가 입력한
// 자유 키워드가 CATEGORY_CID_MAP의 4개 카테고리(패션/뷰티/헬스운동/여행)
// 중 하나에 휴리스틱으로 매칭될 때만 쇼핑인사이트 방향성을 반환하고, 아니면
// category: null로 응답해 프론트가 그 섹션을 조용히 숨기게 함(§CLAUDE.md 16
// "매핑 없는 카테고리는 섹션 자체를 숨김"과 같은 원칙).
export async function POST(request: Request) {
  let keyword: string;
  try {
    const body = await request.json();
    keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (!keyword) {
    return NextResponse.json({ error: "keyword가 필요합니다." }, { status: 400 });
  }

  const categoryId = matchShoppingCategory(keyword);
  if (!categoryId) {
    return NextResponse.json({ category: null });
  }

  try {
    const direction: TrendDirection | null | undefined = await getCategoryShoppingDirection(categoryId);
    return NextResponse.json({
      category: categoryId,
      label: CATEGORY_CID_MAP[categoryId]?.label ?? categoryId,
      direction: direction ?? null,
    });
  } catch (err) {
    console.error(`[POST /api/shopping-interest] failed for "${keyword}":`, err);
    return NextResponse.json({ category: null });
  }
}
