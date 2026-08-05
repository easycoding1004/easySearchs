import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createWriteHistoryEntry } from "@/lib/notion/writeHistory";
import { isBlogCategory } from "@/lib/write/blogCategories";
import { getErrorMessage } from "@/lib/utils/errors";

const STYLE_PRESETS = ["wordpress", "tistory"] as const;
const LAYOUTS = ["표준형", "매거진형", "미니멀형"] as const;
const FONTS = ["sans", "serif", "rounded", "handwriting", "impact"] as const;

// /api/write(하루 1회 제한 걸린 유료 Claude 호출)와 별개 라우트 — "이 버전으로
// 확정하기" 클릭마다(하루 여러 번 가능) 호출되는 무료 저장 작업이라 그 제한
// 로직과 섞으면 안 됨(naver-blog-id 라우트와 같은 분리 이유). 클라이언트가
// fire-and-forget으로 부르므로 실패해도 사용자 흐름(확정 화면 전환)을 막지
// 않음 — 저장 실패는 콘솔에만 남김.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const title = typeof input.title === "string" ? input.title : "";
  const postBody = typeof input.body === "string" ? input.body : "";
  const category = input.category;
  if (!title || !postBody || !isBlogCategory(category)) {
    return NextResponse.json({ error: "제목·본문·유형이 필요해요." }, { status: 400 });
  }

  const sponsored = input.sponsored === true;
  const tags = Array.isArray(input.tags)
    ? input.tags.filter((t): t is string => typeof t === "string").slice(0, 8)
    : [];
  const stylePreset =
    typeof input.stylePreset === "string" && (STYLE_PRESETS as readonly string[]).includes(input.stylePreset)
      ? (input.stylePreset as (typeof STYLE_PRESETS)[number])
      : null;
  const layout =
    typeof input.layout === "string" && (LAYOUTS as readonly string[]).includes(input.layout)
      ? input.layout
      : "표준형";
  const accentColor = typeof input.accentColor === "string" && input.accentColor ? input.accentColor : null;
  const font =
    typeof input.font === "string" && (FONTS as readonly string[]).includes(input.font)
      ? (input.font as (typeof FONTS)[number])
      : null;

  try {
    const id = await createWriteHistoryEntry({
      title,
      body: postBody,
      authorId: user.pageId,
      authorNickname: user.nickname,
      category,
      sponsored,
      tags,
      stylePreset,
      layout,
      accentColor,
      font,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[POST /api/write/history] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "히스토리 저장에 실패했어요." }, { status: 502 });
  }
}
