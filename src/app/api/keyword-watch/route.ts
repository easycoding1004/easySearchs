import { NextResponse } from "next/server";
import { createKeywordWatch } from "@/lib/notion/keywordWatches";
import { getCurrentUser } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

const MAX_KEYWORDS_PER_REQUEST = 5; // MAX_SEED_KEYWORDS와 동일한 상한

interface WatchInput {
  keyword: string;
  baselineCount: number;
}

// 결과 화면(개인 도구 `/result`)의 "관심 키워드 알림 받기" 버튼이 그 세션의
// 시드 키워드 전체(최대 5개)를 한 번에 등록할 수 있도록 배열로 받음.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let items: WatchInput[];
  try {
    const body = await request.json();
    if (!Array.isArray(body.keywords)) throw new Error("invalid");
    items = body.keywords
      .filter(
        (item: unknown): item is WatchInput =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as WatchInput).keyword === "string" &&
          (item as WatchInput).keyword.trim().length > 0 &&
          typeof (item as WatchInput).baselineCount === "number"
      )
      .slice(0, MAX_KEYWORDS_PER_REQUEST);
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "등록할 키워드가 없어요." }, { status: 400 });
  }

  try {
    const watches = await Promise.all(
      items.map((item) => createKeywordWatch(user.pageId, item.keyword.trim(), item.baselineCount))
    );
    return NextResponse.json({ ok: true, watches: watches.map((w) => ({ pageId: w.pageId, keyword: w.keyword })) });
  } catch (err) {
    console.error("[POST /api/keyword-watch] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "등록에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
