import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { setNickname } from "@/lib/notion/users";
import { createHotdealPost, type PriceEntry } from "@/lib/notion/hotdeal";
import { getErrorMessage } from "@/lib/utils/errors";

const MAX_TITLE_LENGTH = 120;
const MAX_MODEL_LENGTH = 80;
const MAX_BODY_LENGTH = 5000;
const MAX_NICKNAME_LENGTH = 20;
const MAX_COMPARISONS = 5;
const MAX_PLATFORM_LENGTH = 30;

function parseComparisons(raw: unknown): PriceEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const entries: PriceEntry[] = [];
  for (const item of raw.slice(0, MAX_COMPARISONS)) {
    if (!item || typeof item !== "object") return null;
    const platform = typeof (item as Record<string, unknown>).platform === "string"
      ? (item as Record<string, unknown>).platform as string
      : "";
    const price = Number((item as Record<string, unknown>).price);
    const url = typeof (item as Record<string, unknown>).url === "string"
      ? (item as Record<string, unknown>).url as string
      : "";
    if (!platform.trim() || !url.trim() || !Number.isFinite(price) || price <= 0) return null;
    entries.push({ platform: platform.trim().slice(0, MAX_PLATFORM_LENGTH), price: Math.round(price), url: url.trim() });
  }
  return entries;
}

// 회원이 직접 상품명·가격비교·구매링크를 등록(§CLAUDE.md 신규 섹션) —
// board.ts의 게시글 작성 라우트와 동일한 로그인+닉네임 흐름, 사진 업로드가
// 없어 FormData 대신 JSON을 씀.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json({ error: "이메일 인증을 먼저 완료해 주세요." }, { status: 403 });
  }

  let json: Record<string, unknown>;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const title = typeof json.title === "string" ? json.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
  const modelName = typeof json.modelName === "string" ? json.modelName.trim().slice(0, MAX_MODEL_LENGTH) : "";
  const body = typeof json.body === "string" ? json.body.trim().slice(0, MAX_BODY_LENGTH) : "";
  if (!title || !modelName) {
    return NextResponse.json({ error: "제목과 모델명을 입력해 주세요." }, { status: 400 });
  }

  const comparisons = parseComparisons(json.comparisons);
  if (!comparisons || comparisons.length === 0) {
    return NextResponse.json(
      { error: "가격 비교 정보를 최소 1개 이상, 형식에 맞게 입력해 주세요." },
      { status: 400 }
    );
  }

  let authorNickname = user.nickname;
  if (!authorNickname) {
    const nicknameInput = typeof json.nickname === "string" ? json.nickname.trim().slice(0, MAX_NICKNAME_LENGTH) : "";
    if (!nicknameInput) {
      return NextResponse.json({ error: "게시판에서 쓸 닉네임을 입력해 주세요." }, { status: 400 });
    }
    await setNickname(user.pageId, nicknameInput);
    authorNickname = nicknameInput;
  }

  try {
    const postId = await createHotdealPost({
      title,
      body,
      modelName,
      authorNickname,
      authorId: user.pageId,
      comparisons,
    });
    return NextResponse.json({ id: postId }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/hotdeal/posts] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "게시글 작성에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
