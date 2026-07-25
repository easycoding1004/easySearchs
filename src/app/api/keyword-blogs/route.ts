import { NextResponse } from "next/server";
import { searchBlog } from "@/lib/naver/openApiClient";
import { stripHtml } from "@/lib/utils/tokenize";
import { createTtlCache } from "@/lib/utils/ttlCache";
import { getErrorMessage } from "@/lib/utils/errors";

const MAX_ITEMS = 5;
// 순위/상위 노출 글이 몇 시간 안에 크게 안 바뀌는 지표라, 같은 키워드에 여러
// 사용자가 반복 호버해도 네이버를 매번 다시 부르지 않도록 캐싱.
const CACHE_TTL_MS = 60 * 60 * 1000;

interface BlogPreviewItem {
  title: string;
  link: string;
  bloggername: string;
}

const cache = createTtlCache<string, BlogPreviewItem[]>(CACHE_TTL_MS);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword")?.trim();

  if (!keyword) {
    return NextResponse.json({ error: "키워드가 필요합니다." }, { status: 400 });
  }

  const cached = cache.get(keyword);
  if (cached) {
    return NextResponse.json({ items: cached });
  }

  try {
    const { items: rawItems } = await searchBlog(keyword);
    const items: BlogPreviewItem[] = rawItems.slice(0, MAX_ITEMS).map((item) => ({
      title: stripHtml(item.title),
      link: item.link,
      bloggername: stripHtml(item.bloggername),
    }));
    cache.set(keyword, items);
    return NextResponse.json({ items });
  } catch (err) {
    const message = getErrorMessage(err);
    console.error(`[GET /api/keyword-blogs] failed for "${keyword}":`, message, err);
    return NextResponse.json({ error: "블로그 목록을 불러오지 못했습니다." }, { status: 502 });
  }
}
