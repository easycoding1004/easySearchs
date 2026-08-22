"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 소셜 로그인으로 처음 가입하는 사람이 도달하는 화면(§CLAUDE.md 19) — 콜백이
// pending-signup 쿠키만 심어두고 계정은 아직 안 만든 상태라, 여기서 필수
// 약관에 동의해야 실제로 /api/auth/agree가 계정을 생성함. 쿠키가 만료됐거나
// (이 페이지를 새로고침/직접 방문 등) 이미 소비된 경우 서버가 에러를
// 돌려주므로 별도 사전 검증 없이 그대로 제출을 시도하고 실패 메시지로 안내.
export default function AgreeForm() {
  const router = useRouter();
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRequired = agreedTerms && agreedPrivacy;

  function toggleAll(checked: boolean) {
    setAgreedTerms(checked);
    setAgreedPrivacy(checked);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allRequired || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/agree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreedTerms, agreedPrivacy }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "가입에 실패했어요.");
        return;
      }
      router.push(typeof data.redirectTo === "string" ? data.redirectTo : "/write");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-lg font-bold text-ink">약관 동의</h1>
        <p className="text-sm text-ink-muted">회원가입을 완료하려면 아래 약관에 동의해 주세요.</p>
      </div>

      <label className="flex items-center gap-2 border-b border-hairline pb-3 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          checked={allRequired}
          onChange={(e) => toggleAll(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        전체 동의
      </label>

      <label className="flex items-center justify-between gap-2 text-sm text-ink">
        <span className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>(필수) 이용약관 동의</span>
        </span>
        <Link href="/terms" target="_blank" className="text-xs text-ink-muted underline hover:text-primary">
          보기
        </Link>
      </label>

      <label className="flex items-center justify-between gap-2 text-sm text-ink">
        <span className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={agreedPrivacy}
            onChange={(e) => setAgreedPrivacy(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>(필수) 개인정보처리방침 동의</span>
        </span>
        <Link href="/privacy" target="_blank" className="text-xs text-ink-muted underline hover:text-primary">
          보기
        </Link>
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={!allRequired || loading}
        className="mt-2 flex h-11 items-center justify-center rounded-md bg-primary text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover disabled:opacity-50 motion-safe:active:scale-[0.97]"
      >
        {loading ? "가입하는 중..." : "동의하고 가입하기"}
      </button>
    </form>
  );
}
