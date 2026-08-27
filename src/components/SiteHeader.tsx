import Image from "next/image";
import Link from "next/link";
import ScrollProgressBar from "./ScrollProgressBar";
import MobileNavMenu from "./MobileNavMenu";
import AuthNavLink from "./AuthNavLink";
import { AI_WRITE_ENABLED } from "@/lib/constants";

// 2026-08 — "핫딜정보" 메뉴는 사용자 요청으로 내비게이션에서 숨김(루리웹
// 자동수집이 배포 환경 네트워크 차단으로 중단되면서 §21.6, 회원 등록
// 콘텐츠만 남아 메뉴에서 빼기로 결정) — /hotdeal 페이지 자체와 기능은
// 그대로 살아있고, 직접 URL로는 계속 접근 가능함. 다시 노출하려면 이
// 배열에 `{ href: "/hotdeal", label: "핫딜정보" }`만 추가하면 됨.
export const NAV_LINKS = [
  { href: "/", label: "키워드 검색량" },
  { href: "/dashboard", label: "블로그지수" },
  { href: "/trending", label: "급상승" },
  { href: "/write", label: "AI 자동글쓰기" },
  { href: "/board", label: "게시판" },
  { href: "/policy-board", label: "소상공인 정책정보" },
  { href: "/blog-type", label: "유형 진단" },
  { href: "/guide", label: "가이드" },
  { href: "/contact", label: "문의하기" },
];

// 2026-08 — 로그인 상태에 따라 "로그인"/"내 정보"를 보여주되(사용자 요청),
// SiteHeader 자체는 여전히 순수 정적 컴포넌트로 유지함 — 세션 쿠키를 읽는
// 로직을 여기 넣으면(async Server Component화) 이 컴포넌트를 쓰는 모든
// 페이지(홈페이지 포함)가 정적 생성에서 빠져 요청마다 서버 렌더링되는 걸
// 실측(next build)으로 확인했음(§10.2 "대부분 완전 공개·무상태" 원칙과
// 정면으로 충돌). 로그인 표시는 AuthNavLink.tsx(client)가 마운트 후
// /api/auth/me를 가볍게 fetch해서 따로 처리 — 페이지 자체는 그대로 정적.
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-hairline bg-surface/85 backdrop-blur">
      <ScrollProgressBar />
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image src="/ezzsearch_logo.png" alt="이지서치" width={94} height={32} priority />
        </Link>
        <nav className="hidden items-center gap-4 whitespace-nowrap text-sm font-medium text-ink-muted lg:flex">
          {NAV_LINKS.map((link) =>
            link.href === "/write" && !AI_WRITE_ENABLED ? (
              <span
                key={link.href}
                title="AI 자동글쓰기는 최종 점검 중이에요. 곧 만나보실 수 있어요!"
                className="flex cursor-not-allowed items-center gap-1.5 text-ink-muted/50"
              >
                {link.label}
                <span className="rounded-full bg-hairline px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                  곧 출시
                </span>
              </span>
            ) : (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-primary">
                {link.label}
              </Link>
            )
          )}
          <AuthNavLink variant="desktop" />
        </nav>
        <MobileNavMenu links={NAV_LINKS} />
      </div>
    </header>
  );
}
