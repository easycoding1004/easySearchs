import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center sm:px-6">
        <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          404
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          페이지를 찾을 수 없어요
        </h1>
        <p className="max-w-sm text-sm text-ink-muted sm:text-base">
          주소가 잘못됐거나, 조회 결과가 만료되었거나 삭제됐을 수 있어요.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
          >
            홈으로 가기
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-hairline px-6 py-3 text-sm font-semibold text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97]"
          >
            블로그지수 확인
          </Link>
        </div>
      </main>
    </div>
  );
}
