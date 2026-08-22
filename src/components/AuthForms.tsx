"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// 2026-08 — 이메일+비밀번호 가입/로그인을 완전히 제거하고 간편로그인(네이버/
// 카카오/구글) 3종만 남김(사용자 요청 — 소셜 3종은 이미 이메일 인증 없이
// 바로 가입되는데, 이메일+비밀번호만 별도로 인증 절차를 거치게 하는 게
// 일관성이 없다는 지적). 비밀번호 해싱·인증메일 발송·인증 라우트까지
// 통째로 걷어냈으니(session.ts/users.ts 참고) 되살리려면 그 커밋을 먼저
// 확인할 것 — 이 컴포넌트는 이제 순수 소셜 로그인 진입점만 담당.
export default function AuthForms() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [error] = useState<string | null>(searchParams.get("error"));

  // 이 페이지 URL 자체에 ?redirect=가 실려 있으면(다른 곳에서 "로그인하러
  // 가기" 링크로 여기로 보낸 경우) 그 값을 우선하고, 없으면 지금 렌더링되고
  // 있는 페이지 경로(게시판 글쓰기 페이지에 직접 임베드된 경우 등)를 씀.
  const explicitRedirect = searchParams.get("redirect");
  const effectiveRedirect = explicitRedirect || (pathname && pathname !== "/write" ? pathname : "");
  const redirectParam = effectiveRedirect ? `?redirect=${encodeURIComponent(effectiveRedirect)}` : "";

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
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

      {error && <p className="text-center text-sm text-error">{error}</p>}
    </div>
  );
}
