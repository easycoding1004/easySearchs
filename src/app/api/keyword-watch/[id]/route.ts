import { NextResponse } from "next/server";
import { getKeywordWatchesByAuthor, deleteKeywordWatch } from "@/lib/notion/keywordWatches";
import { getCurrentUser } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/errors";

// 소유자 확인 후 소프트 삭제(archive) — /mypage의 해지 버튼에서 씀.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const mine = await getKeywordWatchesByAuthor(user.pageId);
    if (!mine.some((w) => w.pageId === id)) {
      return NextResponse.json({ error: "본인이 등록한 키워드만 해지할 수 있어요." }, { status: 403 });
    }
    await deleteKeywordWatch(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/keyword-watch/[id]] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "해지에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
