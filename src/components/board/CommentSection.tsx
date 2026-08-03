"use client";

import { useState } from "react";
import Link from "next/link";
import type { BoardComment } from "@/lib/notion/board";
import { formatKstDateTime } from "@/lib/utils/formatDate";

const MAX_CONTENT_LENGTH = 1000;
const MAX_NICKNAME_LENGTH = 20;

export default function CommentSection({
  postId,
  initialComments,
  loggedIn,
  needsNickname,
}: {
  postId: string;
  initialComments: BoardComment[];
  loggedIn: boolean;
  needsNickname: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || loading) return;
    if (needsNickname && !nickname.trim()) {
      setError("게시판에서 쓸 닉네임을 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/board/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          nickname: needsNickname ? nickname.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "댓글 작성에 실패했어요.");
        return;
      }
      setComments((prev) => [
        ...prev,
        {
          id: data.id,
          content: content.trim(),
          authorNickname: needsNickname ? nickname.trim() : "",
          createdAt: new Date().toISOString(),
        },
      ]);
      setContent("");
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-hairline pt-4">
      <h2 className="text-sm font-semibold text-ink">댓글 {comments.length}개</h2>

      {comments.length > 0 && (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-md bg-bg p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span className="font-semibold text-ink">{c.authorNickname || "익명"}</span>
                <span>{formatKstDateTime(c.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-ink">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      {loggedIn ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          {needsNickname && (
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={MAX_NICKNAME_LENGTH}
              placeholder="게시판에서 쓸 닉네임"
              disabled={loading}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
          )}
          <div className="flex gap-2">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={MAX_CONTENT_LENGTH}
              placeholder="댓글을 입력해 주세요"
              disabled={loading}
              className="flex-1 h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="shrink-0 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              등록
            </button>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
        </form>
      ) : (
        <p className="text-sm text-ink-muted">
          <Link href={`/write?redirect=${encodeURIComponent(`/board/${postId}`)}`} className="text-primary hover:underline">
            로그인
          </Link>
          하면 댓글을 쓸 수 있어요.
        </p>
      )}
    </div>
  );
}
