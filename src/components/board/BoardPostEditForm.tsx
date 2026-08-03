"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_TITLE_LENGTH = 120;

// 제목·본문만 수정 가능 — 사진은 최초 작성 때만 업로드하는 흐름이라(§CLAUDE.md
// 16 게시판 항목) 수정 폼에서는 다루지 않음. 본문에 이미 있는 "[이미지N]"
// 토큰은 텍스트로 그대로 남아있으니 지우지만 않으면 기존 사진이 계속 보임.
export default function BoardPostEditForm({
  postId,
  initialTitle,
  initialBody,
}: {
  postId: string;
  initialTitle: string;
  initialBody: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/board/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "게시글 수정에 실패했어요.");
        return;
      }
      router.push(`/board/${postId}`);
      router.refresh();
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
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          disabled={loading}
          className="rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading || !title.trim() || !body.trim()}
        className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
      >
        {loading ? "저장하는 중..." : "저장하기"}
      </button>
    </form>
  );
}
