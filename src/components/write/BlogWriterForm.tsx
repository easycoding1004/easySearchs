"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BLOG_CATEGORIES, type BlogCategory } from "@/lib/write/blogCategories";

const MAX_IMAGES = 5;

interface StockImage {
  query: string;
  webformatURL: string;
  pageURL: string;
}

interface WriteResult {
  title: string;
  body: string;
  recommendedThumbnail: number;
  thumbnailReason: string;
  tags: string[];
  category: BlogCategory;
  stockImages: StockImage[];
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
  const [copied, setCopied] = useState(false);
  const [tagsCopied, setTagsCopied] = useState(false);

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
    if (files.length === 0 || !prompt.trim() || loading || hasUsedToday) return;

    setLoading(true);
    setError(null);
    setResult(null);

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

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`${result.title}\n\n${result.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access blocked — no feedback to show.
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
            <span className="font-medium text-ink">사진 (최대 {MAX_IMAGES}장)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileSelect}
              disabled={loading}
              className="text-sm text-ink-muted file:mr-3 file:rounded-md file:border file:border-hairline file:bg-bg file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
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
            disabled={loading || files.length === 0 || !prompt.trim()}
            className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? "글 쓰는 중... (최대 1분 정도 걸려요)" : "글 생성하기"}
          </button>
        </form>
      )}

      {result && (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">생성된 글</h2>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-bg"
            >
              {copied ? "복사됐어요" : "전체 복사"}
            </button>
          </div>
          <p className="font-semibold text-ink">{result.title}</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{result.body}</p>
          {previews[result.recommendedThumbnail - 1] && (
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
                추천 스톡 이미지 (Pixabay 제공, 클릭하면 원본 페이지로 이동)
              </span>
              <div className="flex flex-wrap gap-2">
                {result.stockImages.map((img) => (
                  <a key={img.webformatURL} href={img.pageURL} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.webformatURL}
                      alt={img.query}
                      className="h-16 w-16 rounded-md border border-hairline object-cover"
                    />
                  </a>
                ))}
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
