"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Always renders visible in the initial/server-rendered HTML — no-JS or
// slow-hydration visitors never lose content. Only once mounted does it
// (synchronously, before paint) hide elements that are below the fold, so
// they can then fade+slide in as the user scrolls to them.
export default function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const [primed, setPrimed] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const rect = el.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyVisible) return;

    setHidden(true);
    setPrimed(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${primed ? "reveal-init" : ""} ${hidden ? "reveal-hidden" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
