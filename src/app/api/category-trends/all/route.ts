import { NextResponse } from "next/server";
import { CATEGORIES, getCategoryTopKeywords } from "@/lib/naver/categoryTrends";

// Backs the homepage's ticker (TrendTicker) — pulls every category's top
// few keywords in one response. Each category is independently TTL-cached
// (categoryTrends.ts), so this is fast once warm; on a cold cache it walks
// them sequentially under the shared Naver throttle, which is fine since
// the ticker is a background/decorative fetch that doesn't block the page.
export async function GET() {
  // Sequential, not Promise.all — a cold cache means these hit Naver's
  // keywordstool API for real, and this project stays conservative about
  // bursting that shared quota even outside the Open API's own throttle.
  const results = [];
  for (const category of CATEGORIES) {
    try {
      const { rows } = await getCategoryTopKeywords(category.id);
      results.push({ label: category.label, rows: rows.slice(0, 3) });
    } catch {
      results.push({ label: category.label, rows: [] });
    }
  }

  return NextResponse.json({ categories: results });
}
