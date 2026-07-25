"use client";

import { useState } from "react";

// Web Share API delegates to the OS share sheet, which on Korean mobile
// browsers already lists KakaoTalk/문자/Naver alongside everything else —
// no Kakao SDK app key or account setup needed. Desktop browsers (and any
// mobile browser without navigator.share) fall back to copying the link,
// since the result URL is already public (same shareability as CSV
// download, just for the page itself instead of the data).
export default function ShareResultButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User closed the share sheet — not an error.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access blocked — no feedback to show, but nothing to
      // recover from either.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center gap-1.5 self-start rounded-md border border-hairline px-4 py-2 text-sm font-medium text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97] sm:self-auto"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {copied ? "링크가 복사됐어요" : "결과 공유하기"}
    </button>
  );
}
