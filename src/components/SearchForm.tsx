"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_SEED_KEYWORDS } from "@/lib/constants";
import { readSseStream } from "@/lib/utils/readSseStream";
import { addRecentKeywords } from "@/lib/utils/recentKeywords";
import SearchProgressModal from "@/components/SearchProgressModal";
import RecentKeywordsChips from "@/components/RecentKeywordsChips";

function parseKeywordCount(raw: string): number {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SearchForm() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || loading) return;

    const count = parseKeywordCount(keyword);
    if (count > MAX_SEED_KEYWORDS) {
      setError(`키워드는 최대 ${MAX_SEED_KEYWORDS}개까지 입력할 수 있습니다.`);
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("검색 준비 중...");
    setProgress(0);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "검색에 실패했습니다.");
        return;
      }

      let sessionId: string | null = null;
      await readSseStream(res, (data) => {
        if (typeof data.status === "string") setStatus(data.status);
        if (typeof data.progress === "number") setProgress(data.progress);
        if (data.done) {
          if (typeof data.error === "string") setError(data.error);
          else if (typeof data.sessionId === "string") sessionId = data.sessionId;
        }
      });

      if (sessionId) {
        addRecentKeywords(keyword);
        setProgress(100);
        setStatus("완료!");
        await sleep(300);
        router.push(`/result/${sessionId}`);
        return;
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setStatus(null);
      setProgress(0);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-2">
      <div className="flex min-w-0 gap-2 rounded-lg border-2 border-hairline bg-surface p-2 shadow-sm transition-colors focus-within:border-primary">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="예: 크리스마스 케이크 주문 (콤마로 최대 5개)"
          className="h-12 min-w-0 flex-1 border-none bg-transparent px-3 text-base text-ink placeholder:text-ink-muted focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !keyword.trim()}
          className="h-12 shrink-0 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
        >
          {loading ? "검색 중..." : "검색"}
        </button>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      {!loading && <RecentKeywordsChips onSelect={setKeyword} />}
      {loading && <SearchProgressModal status={status} progress={progress} />}
    </form>
  );
}
