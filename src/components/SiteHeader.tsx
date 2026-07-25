import Image from "next/image";
import Link from "next/link";
import ScrollProgressBar from "./ScrollProgressBar";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-hairline bg-surface/85 backdrop-blur">
      <ScrollProgressBar />
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image src="/ezzsearch_logo.png" alt="ezzsearch" width={94} height={32} priority />
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-ink-muted">
          <Link href="/" className="transition-colors hover:text-primary">
            키워드 검색량
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-primary">
            블로그지수
          </Link>
          <Link href="/guide" className="transition-colors hover:text-primary">
            가이드
          </Link>
          <Link href="/contact" className="transition-colors hover:text-primary">
            문의하기
          </Link>
        </nav>
      </div>
    </header>
  );
}
