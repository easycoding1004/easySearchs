"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_IMAGES = 10;
const MAX_TITLE_LENGTH = 120;
const MAX_NICKNAME_LENGTH = 20;

// 2026-08 게시판 작성 폼(§CLAUDE.md 16) — 사용자 확인 결과 "간단한 텍스트 +
// 붙여넣기/업로드 자동삽입" 방식으로 확정(리치 WYSIWYG 아님). textarea에
// 이미지를 붙여넣거나 파일로 선택하면 즉시 "[이미지N]" 토큰을 삽입하고,
// 실제 업로드는 최종 제출 때 한 번에(AI 블로그 /api/write와 같은 패턴) —
// 붙여넣기 시점엔 브라우저 로컬 blob 미리보기만 보여준다.
export default function BoardPostForm({ needsNickname }: { needsNickname: boolean }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [nickname, setNicknameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);

  function insertAtCursor(token: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((prev) => `${prev}\n\n${token}\n\n`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}\n\n${token}\n\n${body.slice(end)}`;
    setBody(next);
    // 다음 렌더 이후 커서를 삽입된 토큰 바로 뒤로 이동.
    requestAnimationFrame(() => {
      const pos = start + token.length + 4;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function addImages(files: File[]) {
    if (images.length + files.length > MAX_IMAGES) {
      setError(`사진은 최대 ${MAX_IMAGES}장까지예요.`);
      return;
    }
    setImages((prev) => {
      const next = [...prev, ...files];
      files.forEach((_, i) => insertAtCursor(`[이미지${prev.length + i + 1}]`));
      return next;
    });
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItems = Array.from(e.clipboardData.items).filter((item) => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems.map((item) => item.getAsFile()).filter((f): f is File => f !== null);
    addImages(files);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    addImages(files);
    e.target.value = ""; // 같은 파일을 다시 골라도 change가 또 발생하게
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || loading) return;
    if (needsNickname && !nickname.trim()) {
      setError("게시판에서 쓸 닉네임을 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("body", body.trim());
      if (needsNickname) formData.set("nickname", nickname.trim());
      for (const file of images) formData.append("images", file);

      const res = await fetch("/api/board/posts", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "게시글 작성에 실패했어요.");
        return;
      }
      router.push(`/board/${data.id}`);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl flex-col gap-3 rounded-lg border-2 border-hairline bg-surface p-4 shadow-sm sm:p-5"
    >
      {needsNickname && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">닉네임 (처음 한 번만 설정, 이후 게시글에 계속 표시돼요)</span>
          <input
            value={nickname}
            onChange={(e) => setNicknameInput(e.target.value)}
            maxLength={MAX_NICKNAME_LENGTH}
            placeholder="게시판에서 쓸 이름"
            disabled={loading}
            className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          disabled={loading}
          className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">내용</span>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={handlePaste}
          rows={10}
          placeholder="내용을 입력하고, 사진은 붙여넣거나 아래에서 선택해 주세요."
          disabled={loading}
          className="rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">사진 (선택, 최대 {MAX_IMAGES}장 — 붙여넣기도 가능해요)</span>
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
              alt={`사진 ${i + 1}`}
              className="h-16 w-16 rounded-md border border-hairline object-cover"
            />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading || !title.trim() || !body.trim()}
        className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
      >
        {loading ? "게시하는 중..." : "게시하기"}
      </button>
    </form>
  );
}
