"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// 2026-08 부활(사용자 요청 — "ID PW 기입이 있는 로그인 페이지로 전면 변경,
// 아래 간편 로그인을 달아주는 형태로 현시스템을 전부 변경") — 한 번 걷어냈던
// 이메일+비밀번호 로그인을 이 컴포넌트에 다시 얹음(§CLAUDE.md 22). 이
// 컴포넌트는 여전히 여러 곳(게시판/AI 글쓰기/핫딜 글쓰기/구독)에 인라인으로
// 임베드되고, 동시에 새 전용 `/login` 페이지도 이 컴포넌트를 그대로 씀 —
// 하나의 컴포넌트로 "인라인 로그인 프롬프트"와 "전용 로그인 페이지" 둘 다
// 커버해서 로직 중복을 피함.
export default function AuthForms() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [oauthError] = useState<string | null>(searchParams.get("error"));
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  // 이 페이지 URL 자체에 ?redirect=가 실려 있으면(다른 곳에서 "로그인하러
  // 가기" 링크로 여기로 보낸 경우) 그 값을 우선하고, 없으면 지금 렌더링되고
  // 있는 페이지 경로(게시판 글쓰기 페이지에 직접 임베드된 경우 등)를 씀.
  const explicitRedirect = searchParams.get("redirect");
  const effectiveRedirect = explicitRedirect || (pathname && pathname !== "/write" ? pathname : "");
  const redirectParam = effectiveRedirect ? `?redirect=${encodeURIComponent(effectiveRedirect)}` : "";

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNeedsVerification(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "로그인에 실패했어요.");
        setNeedsVerification(Boolean(data.needsVerification));
        return;
      }
      router.push(effectiveRedirect || "/write");
      router.refresh();
    } catch {
      setFormError("로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form onSubmit={handleLogin} className="flex flex-col gap-2">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 rounded-md border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-md border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 items-center justify-center rounded-md bg-primary text-sm font-semibold text-white transition ease-spring hover:opacity-90 motion-safe:active:scale-[0.97] disabled:opacity-60"
        >
          {submitting ? "로그인 중..." : "로그인"}
        </button>
        {formError && (
          <p className="text-center text-sm text-error">
            {formError}
            {needsVerification && (
              <>
                {" "}
                <Link href="/signup" className="underline">
                  가입 다시 하기
                </Link>
              </>
            )}
          </p>
        )}
      </form>

      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-hairline" />
        또는 간편 로그인
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div className="flex flex-col gap-2">
        <a
          href={`/api/auth/naver${redirectParam}`}
          className="flex h-11 items-center justify-center rounded-md bg-[#03C75A] text-sm font-semibold text-white transition ease-spring hover:opacity-90 motion-safe:active:scale-[0.97]"
        >
          네이버로 계속하기
        </a>
        <a
          href={`/api/auth/kakao${redirectParam}`}
          className="flex h-11 items-center justify-center rounded-md bg-[#FEE500] text-sm font-semibold text-[#191919] transition ease-spring hover:opacity-90 motion-safe:active:scale-[0.97]"
        >
          카카오로 계속하기
        </a>
        <a
          href={`/api/auth/google${redirectParam}`}
          className="flex h-11 items-center justify-center rounded-md border border-hairline bg-white text-sm font-semibold text-[#191919] transition ease-spring hover:opacity-90 motion-safe:active:scale-[0.97]"
        >
          구글로 계속하기
        </a>
      </div>

      <p className="text-center text-xs text-ink-muted">
        계정이 없으신가요?{" "}
        <Link href={`/signup${redirectParam}`} className="underline hover:text-primary">
          회원가입
        </Link>
      </p>

      {/* 2026-08 추가 — OAuth를 시작하기 전에 약관을 미리 고지함(사용자
          요청 — "게시판 글쓰기/AI 글쓰기 진입 시 로그인 전에 약관 동의
          흐름"). 신규 가입자인지 기존 회원인지는 OAuth가 끝나야만 알 수
          있어서, 매번 이 앞에 별도 "회원가입" 화면을 끼워넣으면 기존
          회원도 재로그인할 때마다 가입하는 것처럼 보이는 화면을 거치게
          됨 — 그래서 화면 전환 대신 이 문구만 추가하고, 실제 체크박스
          동의(termsAgreedAt 기록)는 지금처럼 진짜 신규 가입자에게만
          /signup/agree에서 받음(§CLAUDE.md 16.7 참고).*/}
      <p className="text-center text-xs text-ink-muted">
        계속 진행하면{" "}
        <Link href="/terms" target="_blank" className="underline hover:text-primary">
          이용약관
        </Link>
        과{" "}
        <Link href="/privacy" target="_blank" className="underline hover:text-primary">
          개인정보처리방침
        </Link>
        에 동의하는 것으로 간주돼요.
      </p>

      {oauthError && <p className="text-center text-sm text-error">{oauthError}</p>}
    </div>
  );
}
