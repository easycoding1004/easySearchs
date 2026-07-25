"use client";

import { useEffect, useState } from "react";

interface BlogPreviewItem {
  title: string;
  link: string;
  bloggername: string;
}

type FetchResult =
  | { keyword: string; status: "ok"; items: BlogPreviewItem[] }
  | { keyword: string; status: "error" };

const FETCH_DEBOUNCE_MS = 200;

// 막대를 호버/클릭하면 열리고, 이후에는 다른 막대를 다시 호버/클릭하기 전까지
// 내용이 안 바뀜 — 예전엔 마우스가 막대를 벗어나기만 해도(모달 쪽으로 이동하는
// 중에도) 목록이 사라지거나 바뀌어서 링크를 클릭할 수 없었음. 명시적으로 닫기
// 전까지는 떠 있는 게 모달의 핵심이라 onMouseLeave로 지우지 않음.
export default function KeywordBlogModal({
  keyword,
  onClose,
}: {
  keyword: string | null;
  onClose: () => void;
}) {
  const [result, setResult] = useState<FetchResult | null>(null);

  useEffect(() => {
    if (!keyword) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/keyword-blogs?keyword=${encodeURIComponent(keyword)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: { items?: BlogPreviewItem[] }) => {
          if (!cancelled) setResult({ keyword, status: "ok", items: data.items ?? [] });
        })
        .catch(() => {
          if (!cancelled) setResult({ keyword, status: "error" });
        });
    }, FETCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword]);

  useEffect(() => {
    if (!keyword) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyword, onClose]);

  if (!keyword) return null;

  const loading = result?.keyword !== keyword;
  const items = !loading && result?.status === "ok" ? result.items : null;
  const error = !loading && result?.status === "error";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 rounded-lg bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="line-clamp-1 text-base font-semibold text-ink">
            &quot;{keyword}&quot; 검색 결과
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto">
          {loading && <div className="text-sm text-ink-muted">불러오는 중...</div>}
          {error && (
            <div className="text-sm text-error">블로그 목록을 불러오지 못했어요.</div>
          )}
          {items && items.length === 0 && (
            <div className="text-sm text-ink-muted">검색된 블로그가 없어요.</div>
          )}
          {items && items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.link}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md border border-hairline bg-bg p-3 transition-colors hover:border-primary"
                  >
                    <div className="line-clamp-2 text-sm font-medium text-ink">{item.title}</div>
                    <div className="mt-1 text-xs text-ink-muted">{item.bloggername}</div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
