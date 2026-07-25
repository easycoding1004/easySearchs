import { NextResponse } from "next/server";
import { getCategoryTopKeywords } from "@/lib/naver/categoryTrends";
import { getCategoryShoppingDirection } from "@/lib/naver/categoryShoppingTrend";

// Backs the auto-rotating BEST10 carousel (CategoryTopKeywordsPanel) — the
// page itself only server-renders the initially-selected category; this
// lets the client fetch the others on demand as it cycles, reusing the
// same TTL cache getCategoryTopKeywords already has.
export async function GET(request: Request) {
  const categoryId = new URL(request.url).searchParams.get("category");
  if (!categoryId) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  try {
    const [result, shoppingDirection] = await Promise.all([
      getCategoryTopKeywords(categoryId),
      getCategoryShoppingDirection(categoryId),
    ]);
    return NextResponse.json({
      categoryId: result.category.id,
      rows: result.rows,
      fetchedAt: result.fetchedAt,
      // CID 매핑이 없는 카테고리는 undefined — "데이터 없음"을 지어내지
      // 않고 프론트에서 그 섹션 자체를 안 그리게 함.
      shoppingDirection,
    });
  } catch (err) {
    console.error(`[GET /api/category-trends] failed for "${categoryId}":`, err);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 502 });
  }
}
