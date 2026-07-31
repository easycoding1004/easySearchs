"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_BLOG_SCORE_COMPETITORS, MAX_BLOG_SCORE_KEYWORDS } from "@/lib/constants";
import { readSseStream } from "@/lib/utils/readSseStream";
import SearchProgressModal from "@/components/SearchProgressModal";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function BlogScoreForm() {
  const router = useRouter();
  const [myBlogDomain, setMyBlogDomain] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!myBlogDomain.trim() || loading) return;

    setLoading(true);
    setError(null);
    setStatus("분석 준비 중...");
    setProgress(0);

    try {
      const res = await fetch("/api/blog-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ myBlogDomain, businessName, competitors, keywords }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "조회에 실패했습니다.");
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
        setProgress(100);
        setStatus("완료!");
        await sleep(300);
        router.push(`/dashboard/${sessionId}`);
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
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xl flex-col gap-3 rounded-lg border-2 border-hairline bg-surface p-4 text-left shadow-sm transition-colors focus-within:border-primary sm:p-5"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">내 블로그 주소</span>
        <input
          type="text"
          value={myBlogDomain}
          onChange={(e) => setMyBlogDomain(e.target.value)}
          placeholder="예: blog.naver.com/my_blog"
          className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          disabled={loading}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">업체명 (선택, 지역·플레이스 노출순위 조회용)</span>
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="예: 이지카페 강남점"
          className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          disabled={loading}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">
          비교할 블로그 주소 (선택, 콤마로 구분, 최대 {MAX_BLOG_SCORE_COMPETITORS}개)
        </span>
        <input
          type="text"
          value={competitors}
          onChange={(e) => setCompetitors(e.target.value)}
          placeholder="예: blog.naver.com/competitor1, blog.naver.com/competitor2"
          className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          disabled={loading}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">
          키워드 (선택, 콤마로 구분, 최대 {MAX_BLOG_SCORE_KEYWORDS}개)
        </span>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="예: 강남역맛집, 홍대카페"
          className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          disabled={loading}
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading || !myBlogDomain.trim()}
        className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
      >
        {loading ? "분석 중..." : "블로그지수 확인하기"}
      </button>

      {loading && <SearchProgressModal status={status} progress={progress} />}
    </form>
  );
}
