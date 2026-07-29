import { NextResponse } from "next/server";
import { hasUsedToday, markUsedToday } from "@/lib/notion/users";
import { getCurrentUser } from "@/lib/write/auth";
import { generateBlogPost, type BlogWriterImage } from "@/lib/write/blogWriter";
import { getErrorMessage } from "@/lib/utils/errors";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_PROMPT_LENGTH = 500;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json({ error: "이메일 인증을 먼저 완료해 주세요." }, { status: 403 });
  }
  // 유료 API 남용 방지 — 계정당 하루 1회로 제한 (CLAUDE.md §16).
  if (hasUsedToday(user)) {
    return NextResponse.json(
      { error: "오늘은 이미 사용하셨어요. 내일 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const prompt = String(formData.get("prompt") ?? "").trim().slice(0, MAX_PROMPT_LENGTH);
  if (!prompt) {
    return NextResponse.json({ error: "어떤 글을 원하는지 입력해 주세요." }, { status: 400 });
  }

  const files = formData.getAll("images").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "사진을 1장 이상 올려주세요." }, { status: 400 });
  }
  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `사진은 최대 ${MAX_IMAGES}장까지예요.` }, { status: 400 });
  }
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "jpg/png/webp/gif 형식의 사진만 올릴 수 있어요." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "사진 1장의 용량은 5MB를 넘을 수 없어요." }, { status: 400 });
    }
  }

  try {
    const images: BlogWriterImage[] = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return {
          base64: buffer.toString("base64"),
          mimeType: file.type as BlogWriterImage["mimeType"],
        };
      })
    );

    const result = await generateBlogPost(images, prompt);
    // 실제로 Claude 호출까지 성공했을 때만 "오늘 사용"으로 기록 — 검증 실패나
    // API 오류로 실패한 시도까지 하루 1회를 소진시키면 안 됨.
    await markUsedToday(user.pageId);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/write] generation failed:", getErrorMessage(err), err);
    return NextResponse.json(
      { error: "글 생성에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }
}
