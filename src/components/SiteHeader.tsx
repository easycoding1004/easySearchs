import Image from "next/image";
import Link from "next/link";
import ScrollProgressBar from "./ScrollProgressBar";
import MobileNavMenu from "./MobileNavMenu";
import { AI_WRITE_ENABLED } from "@/lib/constants";

export const NAV_LINKS = [
  { href: "/", label: "키워드 검색량" },
  { href: "/dashboard", label: "블로그지수" },
  { href: "/trending", label: "급상승" },
  { href: "/write", label: "AI 자동글쓰기" },
  { href: "/board", label: "게시판" },
  { href: "/guide", label: "가이드" },
  { href: "/contact", label: "문의하기" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-hairline bg-surface/85 backdrop-blur">
      <ScrollProgressBar />
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image src="/ezzsearch_logo.png" alt="이지서치" width={94} height={32} priority />
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-ink-muted sm:flex">
          {NAV_LINKS.map((link) =>
            link.href === "/write" && !AI_WRITE_ENABLED ? (
              <span
                key={link.href}
                title="AI 자동글쓰기는 현재 준비 중이에요."
                className="flex cursor-not-allowed items-center gap-1.5 text-ink-muted/50"
              >
                {link.label}
                <span className="rounded-full bg-hairline px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                  개발중
                </span>
              </span>
            ) : (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-primary">
                {link.label}
              </Link>
            )
          )}
        </nav>
        <MobileNavMenu links={NAV_LINKS} />
      </div>
    </header>
  );
}
