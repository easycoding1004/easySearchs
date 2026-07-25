"use client";

import Link from "next/link";
import { useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center sm:px-6">
        <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          오류 발생
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          문제가 생겼어요
        </h1>
        <p className="max-w-sm text-sm text-ink-muted sm:text-base">
          예상하지 못한 오류로 페이지를 불러오지 못했어요. 다시 시도해도 같은
          문제가 계속되면 문의해주세요.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="rounded-md border border-hairline px-6 py-3 text-sm font-semibold text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97]"
          >
            홈으로 가기
          </Link>
        </div>
      </main>
    </div>
  );
}
