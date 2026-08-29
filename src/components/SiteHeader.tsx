import Link from "next/link";
import ScrollProgressBar from "./ScrollProgressBar";
import BrandLogo from "./BrandLogo";
import MobileNavMenu from "./MobileNavMenu";
import AuthNavLink from "./AuthNavLink";
import { AI_WRITE_ENABLED } from "@/lib/constants";

// 2026-08 재설계(1단계) — flat 9개 메뉴를 "성장 루프" 기준 그룹으로 재편:
// 진단 → 키워드(계획) → AI 글쓰기(작성) → 소식·커뮤니티. 라벨도 기능명이
// 아니라 행동명으로 바꿔서 내비게이션 자체가 신규 방문자용 온보딩이 되게 함.
// - 키워드 검색량 조회는 홈(`/`)에서 새 `/search` 페이지로 이동(홈 Hero가
//   블로그 진단 입력으로 바뀌면서 — src/app/page.tsx 참고).
// - 문의하기는 메뉴에서 내리고 푸터 링크로만 유지.
// - 핫딜정보는 노출 종료(HOTDEAL_ENABLED=false, constants.ts 참고).
// - 유형 진단은 진단 그룹에 흡수, 가이드는 소식·커뮤니티 그룹에 흡수.
export type NavGroup = {
  label: string;
  // 그룹 라벨 자체를 클릭했을 때 가는 대표 페이지 — 드롭다운이 없는(호버
  // 불가능한) 환경에서도 그룹이 항상 동작하게 하는 폴백.
  href: string;
  items?: { href: string; label: string }[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "블로그 진단",
    href: "/dashboard",
    items: [
      { href: "/dashboard", label: "내 블로그 진단" },
      { href: "/blog-type", label: "블로그 유형 진단" },
    ],
  },
  {
    label: "키워드",
    href: "/search",
    items: [
      { href: "/search", label: "검색량 조회" },
      { href: "/trending", label: "급상승 검색어" },
      { href: "/keywords", label: "업종별 인기 검색어" },
    ],
  },
  // AI 글쓰기는 단독 1급 메뉴 — 재설계에서 유료 전환의 중심축으로 확정됨.
  { label: "AI 글쓰기", href: "/write" },
  {
    label: "소식·커뮤니티",
    href: "/board",
    items: [
      { href: "/board", label: "Q&A 게시판" },
      { href: "/policy-board", label: "소상공인 정책정보" },
      { href: "/guide", label: "가이드" },
    ],
  },
];

// layout.tsx의 SiteNavigationElement JSON-LD가 실제 내비게이션과 어긋나지
// 않도록, 그룹 구조를 평탄화한 목록을 그대로 노출(기존 NAV_LINKS 계약 유지).
export const NAV_LINKS = NAV_GROUPS.flatMap((group) =>
  group.items ? group.items : [{ href: group.href, label: group.label }]
);

// AI 글쓰기 비활성 시에도 클릭 가능한 링크로 둠 — /write에 "출시 알림 받기"
// 이메일 폼이 있어서(재설계 1단계) 막다른 배지가 아니라 리드 수집 진입점임.
function WriteBadge() {
  return (
    <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-on-brand">
      출시 알림
    </span>
  );
}

// 데스크톱 드롭다운은 CSS(hover/focus-within)만으로 동작 — SiteHeader를
// 클라이언트 컴포넌트로 만들면 이 헤더를 쓰는 모든 페이지의 정적 생성이
// 깨질 수 있어(§ 로그인 표시를 AuthNavLink로 분리한 것과 같은 이유) JS 없이
// 유지함. 그룹 라벨 자체가 대표 페이지로 가는 Link라 키보드로도 동작함.
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-hairline bg-surface/85 backdrop-blur">
      <ScrollProgressBar />
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="이지서치 홈" className="flex items-center">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-1 whitespace-nowrap text-sm font-medium text-ink-muted lg:flex">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="group relative">
              <Link
                href={group.href}
                className="flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors hover:bg-bg hover:text-primary"
              >
                {group.label}
                {group.href === "/write" && !AI_WRITE_ENABLED && <WriteBadge />}
                {group.items && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5 opacity-60"
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </Link>
              {group.items && (
                <div className="invisible absolute left-0 top-full z-30 pt-1 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <div className="w-48 rounded-lg border border-hairline bg-surface py-2 shadow-lg">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-bg hover:text-primary"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="ml-2 border-l border-hairline pl-3">
            <AuthNavLink variant="desktop" />
          </div>
        </nav>
        <MobileNavMenu groups={NAV_GROUPS} />
      </div>
    </header>
  );
}
