import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { reviseBlogPost, type BlogWriterImage } from "@/lib/write/blogWriter";
import { isBlogCategory } from "@/lib/write/blogCategories";
import { compressImage } from "@/lib/write/compressImage";
import { searchStockImages } from "@/lib/write/imageSearch";
import { generateAiImages } from "@/lib/write/generateAiImages";
import { getErrorMessage } from "@/lib/utils/errors";

// /api/write/route.ts와 동일한 근거(2026-08 v2 개편, GALLERY 최대 50장) —
// 값도 그대로 맞춰둠.
const MAX_IMAGES = 50;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB (원본 사진 1장 sanity cap)
const MAX_TOTAL_IMAGE_BYTES = 200 * 1024 * 1024; // 200MB (원본 합계 sanity cap)
const MAX_COMPRESSED_BASE64_BYTES = 30 * 1024 * 1024;
const MAX_INSTRUCTION_LENGTH = 300;
// 최초 생성은 하루 1회 제한(§16)으로 막혀 있지만, 이미 생성한 그 글을 다듬는
// 수정 요청까지 매번 새 "하루 1회"를 또 쓰게 하면 사실상 못 쓰는 기능이 됨 —
// 그래서 수정 요청은 hasUsedToday와 별개로 취급하되, 무제한 재호출로 비용이
// 새는 걸 막기 위해 이 라우트 자체에 별도의 낮은 상한을 둠(사용자 요청,
// 2026-07 추가). 클라이언트가 보낸 revisionCount를 그대로 신뢰하진 않고
// 여기서 다시 검증 — 신뢰 수준은 로그인+이메일 인증까지 요구하는 이 기능의
// 기존 방어선(§16)과 동일선상.
const MAX_REVISIONS = 5;
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

  const instruction = String(formData.get("instruction") ?? "").trim().slice(0, MAX_INSTRUCTION_LENGTH);
  if (!instruction) {
    return NextResponse.json({ error: "어떻게 수정할지 입력해 주세요." }, { status: 400 });
  }

  const category = formData.get("category");
  if (!isBlogCategory(category)) {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  // 협찬 여부도 최초 생성 때 정해진 걸 그대로 유지(재판단하지 않음) —
  // category와 동일한 원칙(§CLAUDE.md 16.2).
  const sponsored = String(formData.get("sponsored") ?? "") === "true";

  const revisionCount = Number(formData.get("revisionCount"));
  if (!Number.isInteger(revisionCount) || revisionCount < 0 || revisionCount >= MAX_REVISIONS) {
    return NextResponse.json(
      { error: `이 글은 수정 요청을 최대 ${MAX_REVISIONS}번까지만 반영할 수 있어요.` },
      { status: 429 }
    );
  }

  let previous: { title: string; body: string; tags: string[] };
  try {
    const raw = JSON.parse(String(formData.get("previousResult") ?? ""));
    if (typeof raw.title !== "string" || typeof raw.body !== "string" || !Array.isArray(raw.tags)) {
      throw new Error("invalid shape");
    }
    previous = { title: raw.title, body: raw.body, tags: raw.tags.filter((t: unknown) => typeof t === "string") };
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

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
      return NextResponse.json({ error: "사진 1장의 용량은 15MB를 넘을 수 없어요." }, { status: 400 });
    }
    totalImageBytes += file.size;
  }
  if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "사진 전체 용량이 너무 커요. 사진 개수를 줄여서 다시 시도해 주세요." },
      { status: 400 }
    );
  }

  try {
    const compressed = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return compressImage(buffer, file.type);
      })
    );

    const compressedTotalBytes = compressed.reduce((sum, img) => sum + img.byteLength, 0);
    if (compressedTotalBytes * (4 / 3) > MAX_COMPRESSED_BASE64_BYTES) {
      return NextResponse.json(
        { error: "사진 전체 용량이 너무 커요. 사진 개수를 줄여서 다시 시도해 주세요." },
        { status: 400 }
      );
    }

    const images: BlogWriterImage[] = compressed.map((img) => ({
      base64: img.base64,
      mimeType: img.mimeType,
    }));

    const result = await reviseBlogPost(images, previous, instruction, category, sponsored);

    // 부가 기능(무료 스톡 이미지 추천 + AI 이미지 생성) — /api/write와 동일한
    // 계약(절대 throw 안 함, 병렬 실행).
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
      sponsored,
      stockImages,
      aiImages,
    });
  } catch (err) {
    console.error("[POST /api/write/revise] revision failed:", getErrorMessage(err), err);
    return NextResponse.json(
      { error: "수정에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }
}
