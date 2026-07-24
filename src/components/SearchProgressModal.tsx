"use client";

import { createPortal } from "react-dom";

// Rendered via a portal straight into document.body — template.tsx's page
// transition animates `transform` on an ancestor, and any ancestor
// transform turns `position: fixed` descendants into something positioned
// relative to that ancestor instead of the viewport (a CSS containing-block
// rule), which pushed this modal down to the bottom of the full page
// instead of centering it on screen. Portaling out of the DOM tree avoids
// that regardless of what any future ancestor does.
//
// No SSR/hydration guard needed: callers only render this once `loading`
// flips true from a client-side submit handler, which can't happen before
// hydration, so `document` is always available by the time this mounts.
export default function SearchProgressModal({
  status,
  progress,
}: {
  status: string | null;
  progress: number;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-ink">검색 중...</span>
          <span className="text-sm font-semibold text-primary">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-spring"
            style={{ width: `${progress}%` }}
          />
        </div>
        {status && <p className="mt-3 min-h-[1.25em] text-sm text-ink-muted">{status}</p>}
      </div>
    </div>,
    document.body
  );
}
