"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { KeywordWatch } from "@/lib/notion/keywordWatches";
import { formatKstDateTime } from "@/lib/utils/formatDate";
import PaginatedCardGrid from "@/components/admin/PaginatedCardGrid";

export default function MyKeywordWatchCards({ watches }: { watches: KeywordWatch[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleDelete(pageId: string) {
    setPendingId(pageId);
    try {
      const res = await fetch(`/api/keyword-watch/${pageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setPendingId(null);
    }
  }

  return (
    <PaginatedCardGrid
      items={watches}
      keyExtractor={(watch) => watch.pageId}
      emptyMessage="등록한 관심 키워드가 없어요. 개인 도구 결과 화면에서 키워드를 등록해보세요."
      renderItem={(watch) => (
        <div className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface p-4">
          <span className="text-sm font-medium text-ink">{watch.keyword}</span>
          <span className="text-xs text-ink-muted">
            {watch.lastNotifiedAt
              ? `마지막 알림: ${formatKstDateTime(watch.lastNotifiedAt)} (검색량 ${watch.lastNotifiedCount?.toLocaleString()})`
              : `등록 시점 검색량 ${watch.baselineCount.toLocaleString()} · 아직 알림 없음`}
          </span>
          <button
            type="button"
            onClick={() => handleDelete(watch.pageId)}
            disabled={pendingId === watch.pageId}
            className="mt-1 w-fit rounded-md border border-hairline px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-error hover:text-error disabled:opacity-50"
          >
            {pendingId === watch.pageId ? "해지 중..." : "해지"}
          </button>
        </div>
      )}
    />
  );
}
