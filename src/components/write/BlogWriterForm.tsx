"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BLOG_CATEGORIES, type BlogCategory } from "@/lib/write/blogCategories";
import {
  parseBody,
  stripBodyMarkup,
  renderBodyToHtml,
  createImageResolver,
  type BodyBlock,
} from "@/lib/write/parseBody";

const MAX_IMAGES = 5;

interface StockImage {
  query: string;
  webformatURL: string;
  pageURL: string;
}

interface AiImage {
  prompt: string;
  dataUrl: string;
}

interface WriteResult {
  title: string;
  body: string;
  recommendedThumbnail: number; // 0 = 없음
  thumbnailReason: string;
  tags: string[];
  category: BlogCategory;
  stockImages: StockImage[];
  aiImages: (AiImage | null)[];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// 본문 미리보기 렌더링 — parseBody.ts의 파서를 그대로 써서 clipboard용
// renderBodyToHtml과 같은 마크업 해석 결과를 공유한다(둘이 따로 놀면 화면에
// 보이는 것과 복사되는 것이 달라지는 버그가 생김).
function renderPreviewBlocks(blocks: BodyBlock[], resolveImage: ReturnType<typeof createImageResolver>) {
  return blocks.map((block, i) => {
    if (block.type === "heading") {
      return (
        <h3 key={i} className="mt-1 text-base font-bold text-primary">
          {block.text}
        </h3>
      );
    }
    return (
      <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {block.inline.map((piece, j) => {
          if (piece.type === "text") return <span key={j}>{piece.text}</span>;
          if (piece.type === "em") {
            return (
              <strong key={j} className="font-bold text-primary">
                {piece.text}
              </strong>
            );
          }
          const resolved = resolveImage(piece.token);
          if (!resolved) {
            return (
              <span key={j} className="mx-1 inline-block rounded bg-bg px-2 py-0.5 text-xs text-ink-muted">
                [{piece.token} 자리]
              </span>
            );
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={j}
              src={resolved.src}
              alt={resolved.alt}
              className="my-2 block max-h-72 w-full rounded-md border border-hairline object-cover"
            />
          );
        })}
      </p>
    );
  });
}

export default function BlogWriterForm({
  email,
  hasUsedToday,
  naverBlogId: initialNaverBlogId,
}: {
  email: string;
  hasUsedToday: boolean;
  naverBlogId: string;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [richCopied, setRichCopied] = useState(false);
  const [plainCopied, setPlainCopied] = useState(false);
  const [tagsCopied, setTagsCopied] = useState(false);

  // 사용자가 "추천 스톡 이미지"를 클릭해서 본문의 [스톡이미지] 자리에
  // 끼워 넣은 것들 — 클릭한 순서대로 문서에 나오는 자리에 차례로 채워짐.
  const [insertedStockImages, setInsertedStockImages] = useState<StockImage[]>([]);

  const [naverBlogId, setNaverBlogId] = useState(initialNaverBlogId);
  const [editingBlogId, setEditingBlogId] = useState(false);
  const [blogIdDraft, setBlogIdDraft] = useState(initialNaverBlogId);
  const [savingBlogId, setSavingBlogId] = useState(false);

  const previews = files.map((f) => URL.createObjectURL(f));

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES);
    setFiles(selected);
    setResult(null);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  async function handleSaveBlogId() {
    setSavingBlogId(true);
    try {
      const res = await fetch("/api/write/naver-blog-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naverBlogId: blogIdDraft.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNaverBlogId(data.naverBlogId);
        setEditingBlogId(false);
      }
    } finally {
      setSavingBlogId(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading || hasUsedToday) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setInsertedStockImages([]);

    try {
      const formData = new FormData();
      formData.set("prompt", prompt.trim());
      for (const file of files) formData.append("images", file);

      const res = await fetch("/api/write", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "글 생성에 실패했어요.");
        return;
      }

      setResult(data);
      router.refresh(); // hasUsedToday를 서버에서 다시 계산해 오늘 1회 소진 반영
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  function handleToggleStockImage(img: StockImage) {
    setInsertedStockImages((prev) => {
      const exists = prev.some((p) => p.webformatURL === img.webformatURL);
      if (exists) return prev.filter((p) => p.webformatURL !== img.webformatURL);
      return [...prev, img];
    });
  }

  async function handleCopyPlain() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`${result.title}\n\n${stripBodyMarkup(result.body)}`);
      setPlainCopied(true);
      setTimeout(() => setPlainCopied(false), 2000);
    } catch {
      // Clipboard access blocked — no feedback to show.
    }
  }

  // 네이버 에디터에 붙여넣을 때 굵게/소제목/사진이 그대로 살아 있도록
  // text/html로도 같이 써넣는다. 업로드한 사진은 blob: URL이 다른 origin
  // (blog.naver.com)에서는 못 열리므로 base64 data URL로 바꿔서 넣음 —
  // 스톡/AI 이미지는 이미 원격 URL·data URL이라 그대로 씀. 실제 네이버
  // SmartEditor가 붙여넣기에서 style을 얼마나 살려두는지는 미검증(best-effort).
  async function handleCopyRich() {
    if (!result) return;
    try {
      const photoDataUrls = await Promise.all(files.map(fileToDataUrl));
      const resolveImage = createImageResolver({
        photoSrcs: photoDataUrls,
        insertedStockImages,
        aiImages: result.aiImages,
      });
      const blocks = parseBody(result.body);
      const html = `<h2 style="font-size:22px;font-weight:700;margin:0 0 14px;">${result.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h2>\n${renderBodyToHtml(blocks, resolveImage)}`;
      const plain = `${result.title}\n\n${stripBodyMarkup(result.body)}`;

      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setRichCopied(true);
      setTimeout(() => setRichCopied(false), 2000);
    } catch {
      // Clipboard access blocked or 파일을 읽지 못함 — 피드백 없이 조용히 무시.
    }
  }

  async function handleCopyTags() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.tags.map((t) => `#${t}`).join(" "));
      setTagsCopied(true);
      setTimeout(() => setTagsCopied(false), 2000);
    } catch {
      // Clipboard access blocked — no feedback to show.
    }
  }

  const resultBlocks = result ? parseBody(result.body) : [];
  const resultResolveImage = result
    ? createImageResolver({ photoSrcs: previews, insertedStockImages, aiImages: result.aiImages })
    : null;

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>{email}로 로그인됨</span>
        <button type="button" onClick={handleLogout} className="hover:text-primary">
          로그아웃
        </button>
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-3 text-sm">
        <span className="font-medium text-ink">네이버 블로그 아이디</span>
        {editingBlogId ? (
          <div className="flex gap-2">
            <input
              value={blogIdDraft}
              onChange={(e) => setBlogIdDraft(e.target.value)}
              placeholder="blog.naver.com/여기"
              className="flex-1 rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveBlogId}
              disabled={savingBlogId}
              className="rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-bg disabled:opacity-50"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditingBlogId(false)}
              className="rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-bg"
            >
              취소
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-ink-muted">{naverBlogId || "설정 안 됨"}</span>
            <button
              type="button"
              onClick={() => {
                setBlogIdDraft(naverBlogId);
                setEditingBlogId(true);
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {naverBlogId ? "수정" : "설정"}
            </button>
          </div>
        )}
      </div>

      {hasUsedToday ? (
        <div className="rounded-lg border-2 border-dashed border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-ink-muted">오늘은 이미 사용하셨어요. 내일 다시 시도해 주세요.</p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-lg border-2 border-hairline bg-surface p-4 shadow-sm transition-colors focus-within:border-primary sm:p-5"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">사진 (선택, 최대 {MAX_IMAGES}장)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileSelect}
              disabled={loading}
              className="text-sm text-ink-muted file:mr-3 file:rounded-md file:border file:border-hairline file:bg-bg file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
            <span className="text-xs text-ink-muted">
              사진이 없어도 프롬프트만으로 글을 완성해드려요 — 필요하면 스톡·AI 이미지를 추천해드립니다.
            </span>
          </label>

          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={`업로드한 사진 ${i + 1}`}
                  className="h-16 w-16 rounded-md border border-hairline object-cover"
                />
              ))}
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">어떤 글을 원하시나요?</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예: 이 카페 신메뉴 소개하는 글 써줘, 친근한 톤으로"
              rows={4}
              maxLength={500}
              className="rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              disabled={loading}
            />
            <span className="text-xs text-ink-muted">
              글 유형(정보·리뷰·에세이·홍보 등)은 입력하신 내용을 보고 AI가 자동으로 판단해요.
            </span>
          </label>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? "글 쓰는 중... (최대 1분 정도 걸려요)" : "글 생성하기"}
          </button>
        </form>
      )}

      {result && resultResolveImage && (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">생성된 글</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyPlain}
                className="shrink-0 rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-bg"
              >
                {plainCopied ? "복사됐어요" : "텍스트만 복사"}
              </button>
              <button
                type="button"
                onClick={handleCopyRich}
                className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover"
              >
                {richCopied ? "복사됐어요" : "서식 포함 복사"}
              </button>
            </div>
          </div>
          <p className="text-lg font-bold text-ink">{result.title}</p>
          <div className="flex flex-col gap-1">{renderPreviewBlocks(resultBlocks, resultResolveImage)}</div>

          {result.recommendedThumbnail > 0 && previews[result.recommendedThumbnail - 1] && (
            <div className="flex items-center gap-2 border-t border-hairline pt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[result.recommendedThumbnail - 1]}
                alt="추천 썸네일"
                className="h-12 w-12 rounded-md border border-hairline object-cover"
              />
              <p className="text-xs text-ink-muted">
                추천 썸네일: 사진 {result.recommendedThumbnail}
                {result.thumbnailReason && ` — ${result.thumbnailReason}`}
              </p>
            </div>
          )}

          {result.tags.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-hairline pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-ink-muted">
                  추천 태그 · 유형: {BLOG_CATEGORIES.find((c) => c.id === result.category)?.label}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTags}
                  className="shrink-0 rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-bg"
                >
                  {tagsCopied ? "복사됐어요" : "태그 복사"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {result.tags.map((t) => (
                  <span key={t} className="rounded-full bg-bg px-2 py-0.5 text-xs text-ink">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.stockImages.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-hairline pt-3">
              <span className="text-xs font-semibold text-ink-muted">
                추천 스톡 이미지 (Pixabay 제공) · 클릭하면 위 본문의 [스톡이미지] 자리에 순서대로
                들어가요 (다시 클릭하면 빼요)
              </span>
              <div className="flex flex-wrap gap-2">
                {result.stockImages.map((img) => {
                  const inserted = insertedStockImages.some((p) => p.webformatURL === img.webformatURL);
                  return (
                    <button
                      key={img.webformatURL}
                      type="button"
                      onClick={() => handleToggleStockImage(img)}
                      className={`relative h-16 w-16 overflow-hidden rounded-md border-2 transition ${
                        inserted ? "border-primary" : "border-hairline"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.webformatURL} alt={img.query} className="h-full w-full object-cover" />
                      {inserted && (
                        <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {naverBlogId && (
            <a
              href={`https://blog.naver.com/${naverBlogId}?Redirect=Write&`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
            >
              네이버 블로그 글쓰기 열기
            </a>
          )}
        </div>
      )}
    </div>
  );
}
