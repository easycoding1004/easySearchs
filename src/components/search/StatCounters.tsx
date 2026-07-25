"use client";

import { useEffect, useRef, useState } from "react";

interface StatItem {
  value: number;
  label: string;
}

const DURATION_MS = 1200;

// Counts up from 0 once the section scrolls into view — real numbers from
// Notion (src/lib/notion/stats.ts), not decorative fake ones.
export default function StatCounters({ stats }: { stats: StatItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const [display, setDisplay] = useState<number[]>(() => stats.map(() => 0));

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setDisplay(stats.map((s) => s.value));
      return;
    }

    function animate() {
      const start = performance.now();
      function tick(now: number) {
        const progress = Math.min(1, (now - start) / DURATION_MS);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(stats.map((s) => Math.round(s.value * eased)));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          animate();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [stats]);

  return (
    <div ref={ref} className="grid w-full max-w-2xl grid-cols-3 gap-4 text-center">
      {stats.map((s, i) => (
        <div key={s.label}>
          <div className="text-2xl font-extrabold text-primary sm:text-3xl">
            {display[i].toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-ink-muted sm:text-sm">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
