"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "login" | "signup";

export default function AuthForms() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [signupDone, setSignupDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "요청에 실패했어요.");
        return;
      }

      if (mode === "signup") {
        setSignupDone(true);
      } else {
        router.refresh();
      }
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  if (signupDone) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border-2 border-hairline bg-surface p-8 text-center">
        <h2 className="text-lg font-semibold text-ink">인증 메일을 보냈어요</h2>
        <p className="text-sm text-ink-muted">
          {email}로 받은 메일의 링크를 클릭하면 가입이 완료돼요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-2">
        <a
          href="/api/auth/naver"
          className="flex h-11 items-center justify-center rounded-md bg-[#03C75A] text-sm font-semibold text-white transition ease-spring hover:opacity-90 motion-safe:active:scale-[0.97]"
        >
          네이버로 계속하기
        </a>
        <a
          href="/api/auth/kakao"
          className="flex h-11 items-center justify-center rounded-md bg-[#FEE500] text-sm font-semibold text-[#191919] transition ease-spring hover:opacity-90 motion-safe:active:scale-[0.97]"
        >
          카카오로 계속하기
        </a>
      </div>

      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <div className="h-px flex-1 bg-hairline" />
        또는
        <div className="h-px flex-1 bg-hairline" />
      </div>

    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 rounded-lg border-2 border-hairline bg-surface p-4 text-left shadow-sm transition-colors focus-within:border-primary sm:p-5"
    >
      <div className="flex gap-1 border-b border-hairline pb-3">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === "login" ? "bg-primary text-white" : "text-ink-muted hover:bg-bg"
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === "signup" ? "bg-primary text-white" : "text-ink-muted hover:bg-bg"
          }`}
        >
          회원가입
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">이메일</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          disabled={loading}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "8자 이상" : ""}
          className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          disabled={loading}
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading || !email.trim() || !password}
        className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
      >
        {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입하기"}
      </button>

      <p className="text-xs text-ink-muted">
        AI 블로그 글쓰기는 유료 API를 사용해서 계정당 하루 1회로 제한돼요.
      </p>
    </form>
    </div>
  );
}
