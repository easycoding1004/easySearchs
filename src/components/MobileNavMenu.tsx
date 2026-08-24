"use client";

import Link from "next/link";
import { useState } from "react";
import { AI_WRITE_ENABLED } from "@/lib/constants";

// SiteHeader의 nav가 5개 링크로 늘어나면서 좁은 모바일 화면에서는 로고+nav가
// 뷰포트 폭을 넘어서 버렸음 — sm: 미만에서는 이 햄버거 메뉴로 대체.
export default function MobileNavMenu({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:text-primary"
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
          {open ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-hairline bg-surface py-2 shadow-lg">
          {links.map((link) =>
            link.href === "/write" && !AI_WRITE_ENABLED ? (
              <span
                key={link.href}
                className="flex cursor-not-allowed items-center gap-1.5 px-4 py-2 text-sm font-medium text-ink-muted/50"
              >
                {link.label}
                <span className="rounded-full bg-hairline px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                  개발중
                </span>
              </span>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-bg hover:text-primary"
              >
                {link.label}
              </Link>
            )
          )}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block border-t border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-bg hover:text-primary"
          >
            로그인
          </Link>
        </div>
      )}
    </div>
  );
}
