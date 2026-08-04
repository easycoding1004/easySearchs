import { NextResponse } from "next/server";
import { hasUsedToday, markUsedToday } from "@/lib/notion/users";
import { getCurrentUser } from "@/lib/auth/session";
import { generateBlogPost, type BlogWriterImage } from "@/lib/write/blogWriter";
import { isBlogCategory } from "@/lib/write/blogCategories";
import { compressImage } from "@/lib/write/compressImage";
import { searchStockImages } from "@/lib/write/imageSearch";
import { generateAiImages } from "@/lib/write/generateAiImages";
import { assessLowQualityRisk } from "@/lib/write/lowQualityRisk";
import { createSseStream, SSE_HEADERS } from "@/lib/utils/sse";
import { getErrorMessage } from "@/lib/utils/errors";

// 2026-08 v2 개편 — GALLERY가 최대 50장까지 한 번에 요구할 수 있어(§CLAUDE.md
// 16.2) 개수 상한을 10→50으로 올림. 원본 업로드 용량 캡은 "말도 안 되는
// 업로드"만 막는 sanity cap일 뿐, 실제 Claude 32MB 한도는 압축 후 합계로
// 따로 검사한다(compressImage.ts가 리사이즈·재압축을 하므로 원본 용량과
// 실제 요청 크기가 더 이상 비례하지 않음).
const MAX_IMAGES = 50;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB (원본 사진 1장 sanity cap)
const MAX_TOTAL_IMAGE_BYTES = 200 * 1024 * 1024; // 200MB (원본 합계 sanity cap)
// 압축 후 최종 안전판 — Claude API 요청 전체 크기 한도는 32MB(base64 인코딩
// 포함, base64는 원본 대비 약 4/3배). 30MB로 여유를 둠.
const MAX_COMPRESSED_BASE64_BYTES = 30 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 500;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// TEMP(사용자 요청, 2026-08 — v2 블록 포맷 작업 중이라 반복 테스트 필요):
// 하루 1회 제한을 임시로 꺼둠. 복구 요청 오면 이 상수를 false로 되돌리고
// src/app/write/page.tsx의 같은 이름 상수도 같이 되돌릴 것.
const TEMP_DISABLE_DAILY_LIMIT = true;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json({ error: "이메일 인증을 먼저 완료해 주세요." }, { status: 403 });
  }
  // 유료 API 남용 방지 — 계정당 하루 1회로 제한 (CLAUDE.md §16).
  if (!TEMP_DISABLE_DAILY_LIMIT && hasUsedToday(user)) {
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

  // 2026-08부터 유형은 자동 분류가 아니라 사용자가 16개 중 직접 선택
  // (§CLAUDE.md 16.2) — classifyCategory.ts는 삭제됨.
  const categoryRaw = formData.get("category");
  if (!isBlogCategory(categoryRaw)) {
    return NextResponse.json({ error: "글 유형을 선택해 주세요." }, { status: 400 });
  }
  const category = categoryRaw;
  const sponsored = String(formData.get("sponsored") ?? "") === "true";

  // 사진은 선택 사항 — 프롬프트만으로도 글을 완성할 수 있음.
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

  // 2026-08 사용자 신고 3건을 묶어서 대응 — ① 진행 상태를 안 보여줘서 "멈춘
  // 건가" 오해가 생김, ② (아래 파악) AI 이미지 생성이 60초 타임아웃에 걸려
  // 조용히 실패하고 있었을 가능성, ③ "이미지 생성이 끝나야 페이지가 보였으면"
  // — 이 요청이 통째로 하나의 blocking JSON 응답이라 글(제목·본문)이 이미
  // 다 됐어도 스톡·AI 이미지까지 끝나야만 화면에 아무것도 안 보였음. 사이트의
  // 다른 느린 작업들(§CLAUDE.md 10.5)과 같은 SSE 패턴으로 바꿔서, 진행 상태를
  // 스트리밍하고 글 텍스트가 준비되는 즉시(`textReady`) 이미지를 기다리지 않고
  // 먼저 보여준 뒤, 이미지가 끝나면 그때 채워 넣는다.
  const { stream, send, close } = createSseStream();

  (async () => {
    try {
      send({ status: files.length > 0 ? "사진을 준비하고 있어요..." : "글을 준비하고 있어요...", progress: 5 });

      const compressed = await Promise.all(
        files.map(async (file) => {
          const buffer = Buffer.from(await file.arrayBuffer());
          return compressImage(buffer, file.type);
        })
      );

      const compressedTotalBytes = compressed.reduce((sum, img) => sum + img.byteLength, 0);
      if (compressedTotalBytes * (4 / 3) > MAX_COMPRESSED_BASE64_BYTES) {
        send({ done: true, error: "사진 전체 용량이 너무 커요. 사진 개수를 줄여서 다시 시도해 주세요." });
        return;
      }

      const images: BlogWriterImage[] = compressed.map((img) => ({
        base64: img.base64,
        mimeType: img.mimeType,
      }));

      send({ status: "AI가 글을 쓰고 있어요... (최대 1분 정도 걸려요)", progress: 20 });
      const result = await generateBlogPost(images, prompt, category, sponsored);
      // 실제로 Claude 호출까지 성공했을 때만 "오늘 사용"으로 기록 — 검증 실패나
      // API 오류로 실패한 시도까지 하루 1회를 소진시키면 안 됨.
      await markUsedToday(user.pageId);

      // 글 텍스트는 여기서 이미 완성됨 — 스톡·AI 이미지(부가 기능, 특히 AI
      // 이미지는 장당 수십 초 걸릴 수 있음)를 기다리지 않고 먼저 화면에 보여줌.
      // 저품질 위험도는 생성된 텍스트만으로 즉시 계산 가능해서(네트워크 호출
      // 없음) 여기서 같이 보내도 지연이 전혀 안 생김.
      send({
        textReady: true,
        title: result.title,
        body: result.body,
        recommendedThumbnail: result.recommendedThumbnail,
        thumbnailReason: result.thumbnailReason,
        tags: result.tags,
        category,
        sponsored,
        lowQualityRisk: assessLowQualityRisk(result, sponsored),
        progress: 70,
      });

      send({ status: "스톡·AI 이미지를 준비하고 있어요...", progress: 80 });
      // 부가 기능(무료 스톡 이미지 추천 + AI 이미지 생성) — 둘 다 절대 throw
      // 안 하고 실패/미설정 시 []/null만 반환하는 계약(imageSearch.ts,
      // generateAiImages.ts) — 병렬로 돌려서 전체 대기 시간을 늘리지 않음.
      const [stockImages, aiImages] = await Promise.all([
        searchStockImages(result.stockImageQueries),
        generateAiImages(result.aiImagePrompts),
      ]);

      send({ done: true, stockImages, aiImages, progress: 100 });
    } catch (err) {
      console.error("[POST /api/write] generation failed:", getErrorMessage(err), err);
      send({ done: true, error: "글 생성에 실패했어요. 잠시 후 다시 시도해 주세요." });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: SSE_HEADERS });
}
