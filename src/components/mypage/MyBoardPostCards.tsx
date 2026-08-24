"use client";

import Link from "next/link";
import type { BoardPost } from "@/lib/notion/board";
import { formatKstDateTime } from "@/lib/utils/formatDate";
import PaginatedCardGrid from "@/components/admin/PaginatedCardGrid";

export default function MyBoardPostCards({ posts }: { posts: BoardPost[] }) {
  return (
    <PaginatedCardGrid
      items={posts}
      keyExtractor={(post) => post.id}
      emptyMessage="게시판에 작성한 글이 없어요."
      renderItem={(post) => (
        <Link
          href={`/board/${post.id}`}
          className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-primary"
        >
          <span className="line-clamp-2 text-sm font-medium text-ink">{post.title}</span>
          <span className="text-xs text-ink-muted">{formatKstDateTime(post.createdAt)}</span>
          <span className="text-xs text-ink-muted">댓글 {post.commentCount}개</span>
        </Link>
      )}
    />
  );
}
