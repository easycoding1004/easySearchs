"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ThreadedComment } from "@/lib/notion/threadedComments";

const MAX_CONTENT_LENGTH = 1000;
const MAX_NICKNAME_LENGTH = 20;

// 대댓글 지원 댓글 UI — 정책정보 게시판(§CLAUDE.md 20)과 핫딜정보 게시판
// 둘 다 댓글 API 경로가 `/api/{board}/{postId}/comments`로 완전히 동일한
// 패턴이라 이 컴포넌트 하나를 board 값만 바꿔 공유함(§14 폴더 컨벤션 —
// 2개 이상 기능이 쓰면 components/ 최상위 공유 위치). board.ts의
// CommentSection.tsx와 같은 폼 스타일에 트리 렌더링과 "답글" 버튼이
// 추가된 형태. 새 댓글/답글 등록 후엔 트리를 클라이언트에서 직접
// 이어붙이는 대신 router.refresh()로 서버 트리를 다시 받아옴 — 중첩
// 상태를 직접 스플라이스하는 복잡함을 피함.
type BoardKind = "policy-board" | "hotdeal";

function CommentForm({
  board,
  postId,
  parentCommentId,
  needsNickname,
  onDone,
  placeholder,
  autoFocus,
}: {
  board: BoardKind;
  postId: string;
  parentCommentId: string | null;
  needsNickname: boolean;
  onDone: () => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
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
      const res = await fetch(`/api/${board}/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          nickname: needsNickname ? nickname.trim() : undefined,
          parentCommentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "댓글 작성에 실패했어요.");
        return;
      }
      setContent("");
      router.refresh();
      onDone();
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
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
          autoFocus={autoFocus}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={MAX_CONTENT_LENGTH}
          placeholder={placeholder}
          disabled={loading}
          className="h-10 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
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
  );
}

function CommentNode({
  comment,
  board,
  postId,
  loggedIn,
  needsNickname,
  depth,
}: {
  comment: ThreadedComment;
  board: BoardKind;
  postId: string;
  loggedIn: boolean;
  needsNickname: boolean;
  depth: number;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div className={depth > 0 ? "ml-5 border-l border-hairline pl-3 sm:ml-6" : ""}>
      <div className="rounded-md bg-bg p-3 text-sm">
        <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
          <span className="font-semibold text-ink">{comment.authorNickname || "익명"}</span>
          {loggedIn && (
            <button type="button" onClick={() => setReplying((v) => !v)} className="text-primary hover:underline">
              답글
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-ink">{comment.content}</p>
      </div>

      {replying && (
        <div className="mt-2">
          <CommentForm
            board={board}
            postId={postId}
            parentCommentId={comment.id}
            needsNickname={needsNickname}
            onDone={() => setReplying(false)}
            placeholder="답글을 입력해 주세요"
            autoFocus
          />
        </div>
      )}

      {comment.replies.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              board={board}
              postId={postId}
              loggedIn={loggedIn}
              needsNickname={needsNickname}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({
  board,
  postId,
  comments,
  totalCount,
  loggedIn,
  needsNickname,
}: {
  board: BoardKind;
  postId: string;
  comments: ThreadedComment[];
  totalCount: number;
  loggedIn: boolean;
  needsNickname: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-hairline pt-4">
      <h2 className="text-sm font-semibold text-ink">댓글 {totalCount}개</h2>

      {comments.length > 0 && (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              board={board}
              postId={postId}
              loggedIn={loggedIn}
              needsNickname={needsNickname}
              depth={0}
            />
          ))}
        </div>
      )}

      {loggedIn ? (
        <CommentForm board={board} postId={postId} parentCommentId={null} needsNickname={needsNickname} onDone={() => {}} placeholder="댓글을 입력해 주세요" />
      ) : (
        <p className="text-sm text-ink-muted">
          <Link href={`/write?redirect=${encodeURIComponent(`/${board}/${postId}`)}`} className="text-primary hover:underline">
            로그인
          </Link>
          하면 댓글을 쓸 수 있어요.
        </p>
      )}
    </div>
  );
}
