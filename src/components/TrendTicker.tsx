"use client";

import { useEffect, useState } from "react";

interface TickerItem {
  label: string;
  keyword: string;
  volume: number;
}

// Background fetch on mount (not SSR — this is decorative, shouldn't hold
// up the page while it walks all 8 categories on a cold cache). Renders the
// item list twice back-to-back and animates a continuous -50% translateX
// loop, the standard seamless-marquee trick.
export default function TrendTicker() {
  const [items, setItems] = useState<TickerItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/category-trends/all")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data: { categories: { label: string; rows: { relKeyword: string; monthlyPcQcCnt: number; monthlyMobileQcCnt: number }[] }[] }) => {
        if (cancelled) return;
        const flat: TickerItem[] = data.categories.flatMap((c) =>
          c.rows.map((r) => ({
            label: c.label,
            keyword: r.relKeyword,
            volume: r.monthlyPcQcCnt + r.monthlyMobileQcCnt,
          }))
        );
        setItems(flat);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items || items.length === 0) return null;

  const track = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((item, i) => (
        <span key={i} className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm">
          <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-ink-muted">
            {item.label}
          </span>
          <span className="font-medium text-ink">{item.keyword}</span>
          <span className="text-xs text-ink-muted">{item.volume.toLocaleString()}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="w-full overflow-hidden border-y border-hairline bg-surface py-3">
      <div className="trend-ticker-track flex w-max">
        {track}
        {track}
      </div>
    </div>
  );
}
