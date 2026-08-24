"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// SiteHeader.tsx가 정적으로 남아있어야 하는 이유는 그 파일 주석 참고 —
// 로그인 여부는 여기서만 마운트 후 /api/auth/me를 가볍게 물어봐서 따로
// 처리함. 기본값은 "로그인"(방문자 대부분이 비로그인이라 이 쪽이 깜빡임이
// 덜함) — 실제로 로그인 상태면 fetch 응답이 오는 대로 "내 정보"로 바뀜.
export default function AuthNavLink({ variant }: { variant: "desktop" | "mobile" }) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setLoggedIn(!!data.loggedIn);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const href = loggedIn ? "/mypage" : "/login";
  const label = loggedIn ? "내 정보" : "로그인";

  if (variant === "mobile") {
    return (
      <Link
        href={href}
        className="block border-t border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-bg hover:text-primary"
      >
        {label}
      </Link>
    );
  }

  return (
    <Link href={href} className="font-semibold text-ink transition-colors hover:text-primary">
      {label}
    </Link>
  );
}
