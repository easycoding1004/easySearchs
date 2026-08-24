"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// 이메일+비밀번호 회원가입 전용 폼(§CLAUDE.md 22) — AuthForms.tsx(로그인)와
// 별개 컴포넌트로 둔 이유: 비밀번호 확인 입력·약관 체크박스·"가입 후 인증
// 메일 확인 안내" 같은 가입 전용 상태가 로그인 폼과 섞이면 오히려 복잡해짐.
// 소셜 로그인은 이미 AuthForms.tsx가 처리하므로 여기선 안내 링크만 둠.
export default function SignupForm() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const explicitRedirect = searchParams.get("redirect");
  const effectiveRedirect = explicitRedirect || (pathname && pathname !== "/signup" ? pathname : "");
  const redirectParam = effectiveRedirect ? `?redirect=${encodeURIComponent(effectiveRedirect)}` : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const allRequired = agreedTerms && agreedPrivacy;

  function toggleAll(checked: boolean) {
    setAgreedTerms(checked);
    setAgreedPrivacy(checked);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 해요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 서로 달라요.");
      return;
    }
    if (!allRequired) {
      setError("이용약관과 개인정보처리방침에 모두 동의해야 가입할 수 있어요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, agreedTerms, agreedPrivacy, redirectTo: effectiveRedirect }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "가입에 실패했어요.");
        return;
      }
      setSent(true);
    } catch {
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-hairline bg-surface p-6 text-center">
        <h2 className="text-lg font-bold text-ink">인증 메일을 보냈어요</h2>
        <p className="text-sm text-ink-muted">
          {email}로 보낸 인증 메일의 링크를 눌러야 가입이 완료돼요. 메일함(스팸함도 확인해 주세요)을 확인해 주세요.
        </p>
        <Link href={`/login${redirectParam}`} className="text-sm font-semibold text-primary hover:underline">
          로그인하러 가기 →
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-lg font-bold text-ink">회원가입</h1>
        <p className="text-sm text-ink-muted">이메일과 비밀번호로 가입할 수 있어요.</p>
      </div>

      <input
        type="email"
        required
        autoComplete="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 rounded-md border border-hairline bg-bg px-3 text-sm text-ink outline-none focus:border-primary"
      />
      <input
        type="password"
        required
        autoComplete="new-password"
        placeholder="비밀번호 (8자 이상)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-11 rounded-md border border-hairline bg-bg px-3 text-sm text-ink outline-none focus:border-primary"
      />
      <input
        type="password"
        required
        autoComplete="new-password"
        placeholder="비밀번호 확인"
        value={passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
        className="h-11 rounded-md border border-hairline bg-bg px-3 text-sm text-ink outline-none focus:border-primary"
      />

      <label className="flex items-center gap-2 border-t border-hairline pt-3 text-sm font-semibold text-ink">
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
        disabled={submitting}
        className="mt-1 flex h-11 items-center justify-center rounded-md bg-primary text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover disabled:opacity-50 motion-safe:active:scale-[0.97]"
      >
        {submitting ? "가입하는 중..." : "가입하기"}
      </button>

      <p className="text-center text-xs text-ink-muted">
        이미 계정이 있으신가요?{" "}
        <Link href={`/login${redirectParam}`} className="underline hover:text-primary">
          로그인
        </Link>
      </p>
    </form>
  );
}
