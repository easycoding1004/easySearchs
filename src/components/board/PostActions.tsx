"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 작성 당사자 또는 관리자에게만 보이는 수정/삭제 버튼 — 표시 여부는
// 서버 컴포넌트(board/[postId]/page.tsx)가 canManage를 계산해 넘겨주고,
// 실제 권한 검증은 항상 API 라우트가 다시 함(클라이언트 표시는 UX일 뿐
// 보안 경계가 아님).
export default function PostActions({ postId }: { postId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("정말 삭제하시겠어요? 되돌릴 수 없어요.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/board/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "삭제에 실패했어요.");
        setDeleting(false);
        return;
      }
      router.push("/board");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했어요.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <Link href={`/board/${postId}/edit`} className="text-ink-muted hover:text-primary hover:underline">
        수정
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-ink-muted hover:text-error hover:underline disabled:opacity-50"
      >
        {deleting ? "삭제 중..." : "삭제"}
      </button>
      {error && <span className="text-error">{error}</span>}
    </div>
  );
}
