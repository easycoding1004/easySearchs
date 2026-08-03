import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { setNickname } from "@/lib/notion/users";
import { createBoardPost } from "@/lib/notion/board";
import { compressImage } from "@/lib/write/compressImage";
import { uploadImageToNotion } from "@/lib/notion/boardImageUpload";
import { getErrorMessage } from "@/lib/utils/errors";

// AI 블로그(§CLAUDE.md 16)와 달리 게시판 사진은 사람이 직접 몇 장 붙여넣는
// 수준이라 50장까지 필요 없음 — 자유게시판다운 상한으로 10장.
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 20000;
const MAX_NICKNAME_LENGTH = 20;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json({ error: "이메일 인증을 먼저 완료해 주세요." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_TITLE_LENGTH);
  const body = String(formData.get("body") ?? "").trim().slice(0, MAX_BODY_LENGTH);
  if (!title || !body) {
    return NextResponse.json({ error: "제목과 본문을 입력해 주세요." }, { status: 400 });
  }

  // 닉네임이 없는 사용자의 첫 게시글 — 작성 폼이 같이 보낸 닉네임을 계정에
  // 저장해두고 이후로도 재사용(§CLAUDE.md 16 게시판 항목: 로그인용 이메일을
  // 그대로 공개하지 않기 위한 별도 표시 이름).
  let authorNickname = user.nickname;
  if (!authorNickname) {
    const nicknameInput = String(formData.get("nickname") ?? "").trim().slice(0, MAX_NICKNAME_LENGTH);
    if (!nicknameInput) {
      return NextResponse.json({ error: "게시판에서 쓸 닉네임을 입력해 주세요." }, { status: 400 });
    }
    await setNickname(user.pageId, nicknameInput);
    authorNickname = nicknameInput;
  }

  const files = formData.getAll("images").filter((v): v is File => v instanceof File);
  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `사진은 최대 ${MAX_IMAGES}장까지예요.` }, { status: 400 });
  }
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "jpg/png/webp/gif 형식의 사진만 올릴 수 있어요." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "사진 1장의 용량은 15MB를 넘을 수 없어요." }, { status: 400 });
    }
  }

  try {
    // AI 블로그와 같은 압축 파이프라인(compressImage.ts) 재사용 — 원본
    // 스마트폰 사진을 그대로 Notion에 올리면 느리고 용량도 큼.
    const imageUploadIds = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const compressed = await compressImage(buffer, file.type);
        const ext = compressed.mimeType === "image/gif" ? "gif" : "jpg";
        return uploadImageToNotion(Buffer.from(compressed.base64, "base64"), `image.${ext}`, compressed.mimeType);
      })
    );

    const postId = await createBoardPost({
      title,
      body,
      authorNickname,
      authorId: user.pageId,
      imageUploadIds,
    });

    return NextResponse.json({ id: postId }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/board/posts] failed:", getErrorMessage(err), err);
    return NextResponse.json({ error: "게시글 작성에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
