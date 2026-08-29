"use client";

import Link from "next/link";
import { useState } from "react";
import { AI_WRITE_ENABLED } from "@/lib/constants";
import AuthNavLink from "./AuthNavLink";
import type { NavGroup } from "./SiteHeader";

// 2026-08 재설계(1단계) — flat 링크 목록 대신 SiteHeader의 NAV_GROUPS를
// 그대로 받아 그룹 헤더 + 하위 항목 구조로 렌더링. 데스크톱 nav는
// `lg:`(1024px)부터만 보이고 그 미만은 이 햄버거 메뉴로 통일(기존 결정 유지).
export default function MobileNavMenu({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative lg:hidden">
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
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-hairline bg-surface py-2 shadow-lg">
          {groups.map((group) =>
            group.items ? (
              <div key={group.label} className="mb-1 border-b border-hairline pb-1 last:mb-0 last:border-b-0 last:pb-0">
                <span className="block px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted/70">
                  {group.label}
                </span>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-bg hover:text-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              // 단독 메뉴(AI 글쓰기) — 비활성이어도 /write의 "출시 알림 받기"
              // 폼으로 연결되는 클릭 가능한 링크로 둠(SiteHeader와 동일 원칙).
              <Link
                key={group.href}
                href={group.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-bg hover:text-primary"
              >
                {group.label}
                {group.href === "/write" && !AI_WRITE_ENABLED && (
                  <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-on-brand">
                    출시 알림
                  </span>
                )}
              </Link>
            )
          )}
          <AuthNavLink variant="mobile" />
        </div>
      )}
    </div>
  );
}
