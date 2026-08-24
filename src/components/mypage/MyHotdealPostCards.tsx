"use client";

import Link from "next/link";
import type { HotdealPost } from "@/lib/notion/hotdeal";
import { formatKstDateTime } from "@/lib/utils/formatDate";
import PaginatedCardGrid from "@/components/admin/PaginatedCardGrid";

export default function MyHotdealPostCards({ posts }: { posts: HotdealPost[] }) {
  return (
    <PaginatedCardGrid
      items={posts}
      keyExtractor={(post) => post.id}
      emptyMessage="핫딜정보에 등록한 글이 없어요."
      renderItem={(post) => (
        <Link
          href={`/hotdeal/${post.id}`}
          className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-primary"
        >
          <span className="line-clamp-2 text-sm font-medium text-ink">{post.title}</span>
          <span className="text-xs text-ink-muted">{formatKstDateTime(post.postedAt)}</span>
          {post.lowestPrice != null && (
            <span className="text-xs font-semibold text-primary">{post.lowestPrice.toLocaleString()}원~</span>
          )}
        </Link>
      )}
    />
  );
}
