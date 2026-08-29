import Link from "next/link";

// 2026-08 재설계(1단계) — 홈/검색 페이지가 각자 인라인으로 들고 있던 푸터를
// 공유 컴포넌트로 분리(내비 재편으로 링크 구성이 바뀌면서 두 벌 관리가
// 실수 지점이 됨). 문의하기는 상단 메뉴에서 내려와 여기서만 노출됨.
const FOOTER_LINKS = [
  { href: "/dashboard", label: "내 블로그 진단" },
  { href: "/search", label: "검색량 조회" },
  { href: "/trending", label: "급상승" },
  { href: "/keywords", label: "업종별 키워드" },
  { href: "/keyword", label: "키워드 사전" },
  { href: "/blog-type", label: "유형 진단" },
  { href: "/board", label: "게시판" },
  { href: "/policy-board", label: "소상공인 정책정보" },
  { href: "/guide", label: "가이드" },
  { href: "/mypage", label: "내 정보" },
  { href: "/contact", label: "문의하기" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
];

export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-hairline bg-bg px-4 py-8 pb-24 sm:px-6 sm:pb-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 text-xs text-ink-muted sm:flex-row">
        <span>© 2026 이지서치. All rights reserved.</span>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 sm:justify-end">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-primary">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
