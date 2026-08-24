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
  { href: "/policy-board", label: "소상공인 정책정보" },
  { href: "/hotdeal", label: "핫딜정보" },
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
          {/* 2026-08 추가(§CLAUDE.md 22) — 로그인 상태를 표시하려면 페이지마다
              Notion 세션 조회가 필요해서(비용/지연), 사이트 대부분이 완전
              공개·무상태인 이 프로젝트 원칙(§10.2)과 맞지 않음 — 그래서
              SiteHeader는 로그인 여부와 무관하게 항상 같은 "로그인" 링크만
              보여주는 정적 항목으로 둠. 실제 로그인/로그아웃 상태는 이미
              로그인이 필요한 각 기능 페이지(예: /write의 BlogWriterForm) 안에서만
              확인·표시함. */}
          <Link href="/login" className="font-semibold text-ink transition-colors hover:text-primary">
            로그인
          </Link>
        </nav>
        <MobileNavMenu links={NAV_LINKS} />
      </div>
    </header>
  );
}
