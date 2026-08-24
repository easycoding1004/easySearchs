"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// BlogWriterForm.tsx의 handleLogout과 같은 패턴(POST 후 router.refresh) —
// /mypage는 로그인 전용 페이지라 로그아웃 후엔 그 자리에 남아있을 이유가
// 없어서 홈으로 보냄.
export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-bg disabled:opacity-60"
    >
      {loading ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
