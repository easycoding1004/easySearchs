import { NextResponse } from "next/server";
import { hasUsedToday, markUsedToday } from "@/lib/notion/users";
import { getCurrentUser } from "@/lib/write/auth";
import { generateBlogPost, type BlogWriterImage } from "@/lib/write/blogWriter";
import { classifyPromptCategory } from "@/lib/write/classifyCategory";
import { searchStockImages } from "@/lib/write/imageSearch";
import { generateAiImages } from "@/lib/write/generateAiImages";
import { getErrorMessage } from "@/lib/utils/errors";

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB (per-file sanity cap)
// Claude API의 요청 전체 크기 한도는 32MB(base64 인코딩된 이미지 포함) — base64는
// 원본 대비 약 4/3배로 커지므로, 텍스트 프롬프트 여유분을 감안해 원본 합계를
// 18MB로 제한(18MB × 4/3 ≈ 24MB, 32MB 한도에 여유를 둠). 사진 1장당 5MB 제한만
// 있으면 10장을 각각 5MB로 채웠을 때(원본 50MB → base64 약 66MB) 32MB를 훌쩍
// 넘어 "요청이 너무 큽니다" 에러가 나므로, 개수/장당 용량과 별개로 합계를 따로
// 검사해야 함(사용자 문의로 확인).
const MAX_TOTAL_IMAGE_BYTES = 18 * 1024 * 1024; // 18MB
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

  // 사진은 선택 사항 — 프롬프트만으로도 글을 완성할 수 있음(2026-07 변경).
  const files = formData.getAll("images").filter((v): v is File => v instanceof File);
  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `사진은 최대 ${MAX_IMAGES}장까지예요.` }, { status: 400 });
  }
  let totalImageBytes = 0;
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "jpg/png/webp/gif 형식의 사진만 올릴 수 있어요." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "사진 1장의 용량은 5MB를 넘을 수 없어요." }, { status: 400 });
    }
    totalImageBytes += file.size;
  }
  if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "사진 전체 용량이 너무 커요(총 18MB 이하). 사진을 줄이거나 압축해서 다시 시도해 주세요." },
      { status: 400 }
    );
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

    // 프롬프트만으로 유형을 자동 분류 — 이 결과로 어떤 new_blog/*.md 규칙을
    // 시스템 프롬프트에 넣을지 정해지므로 반드시 본 생성 호출보다 먼저 실행.
    const category = await classifyPromptCategory(prompt);
    const result = await generateBlogPost(images, prompt, category);
    // 실제로 Claude 호출까지 성공했을 때만 "오늘 사용"으로 기록 — 검증 실패나
    // API 오류로 실패한 시도까지 하루 1회를 소진시키면 안 됨.
    await markUsedToday(user.pageId);

    // 부가 기능(무료 스톡 이미지 추천 + AI 이미지 생성) — 둘 다 절대 throw
    // 안 하고 실패/미설정 시 []/null만 반환하는 계약(imageSearch.ts,
    // generateAiImages.ts) — 병렬로 돌려서 전체 응답 시간을 늘리지 않음.
    const [stockImages, aiImages] = await Promise.all([
      searchStockImages(result.stockImageQueries),
      generateAiImages(result.aiImagePrompts),
    ]);

    return NextResponse.json({
      title: result.title,
      body: result.body,
      recommendedThumbnail: result.recommendedThumbnail,
      thumbnailReason: result.thumbnailReason,
      tags: result.tags,
      category,
      stockImages,
      aiImages,
    });
  } catch (err) {
    console.error("[POST /api/write] generation failed:", getErrorMessage(err), err);
    return NextResponse.json(
      { error: "글 생성에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }
}
