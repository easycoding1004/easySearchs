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

export default function KeywordBlogPreview({ keyword }: { keyword: string | null }) {
  // "로딩 중" 여부를 별도 boolean으로 들고 있지 않고 keyword와 result.keyword를
  // 비교해서 파생시킴 — effect 안에서 setState를 동기적으로 호출하지 않고
  // fetch 콜백 안에서만 호출하기 위함(React Compiler 린트 규칙).
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

  if (!keyword) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed border-hairline p-4 text-center text-xs text-ink-muted">
        막대에 마우스를 올리면
        <br />
        검색된 블로그 목록을 볼 수 있어요
      </div>
    );
  }

  const loading = result?.keyword !== keyword;
  const items = !loading && result?.status === "ok" ? result.items : null;
  const error = !loading && result?.status === "error";

  return (
    <div className="flex h-full min-h-[300px] flex-col gap-2 rounded-lg border border-hairline bg-bg p-3">
      <div className="line-clamp-1 text-sm font-semibold text-ink">&quot;{keyword}&quot; 검색 결과</div>
      {loading && <div className="text-xs text-ink-muted">불러오는 중...</div>}
      {error && <div className="text-xs text-error">블로그 목록을 불러오지 못했어요.</div>}
      {items && items.length === 0 && (
        <div className="text-xs text-ink-muted">검색된 블로그가 없어요.</div>
      )}
      {items && items.length > 0 && (
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {items.map((item) => (
            <li key={item.link}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-hairline bg-surface p-2 transition-colors hover:border-primary"
              >
                <div className="line-clamp-2 text-xs font-medium text-ink">{item.title}</div>
                <div className="mt-1 text-[11px] text-ink-muted">{item.bloggername}</div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
