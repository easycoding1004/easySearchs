import Link from "next/link";

// 2026-08 추가(사용자 요청 — "게시판 포지셔닝") — 게시판이 핵심 기능과
// 겉도는 범용 자유게시판처럼 느껴진다는 지적에 따라, 검색/블로그지수 결과
// 화면에서 게시판으로 자연스럽게 연결되는 도입부를 추가함. 게시판 자체가
// 이미 대부분 "이 기능 어떻게 써요?" 류의 FAQ성 질문으로 채워져 있어서
// (§CLAUDE.md 18), 결과를 보다가 궁금한 점이 생겼을 때 바로 물어볼 수 있는
// 동선으로 자연스럽게 이어짐 — 두 제품(개인 도구/블로그지수) 모두 이 결과
// 화면을 쓰므로 최상위 공유 위치에 둠(§CLAUDE.md 14).
export default function BoardPromptLink() {
  return (
    <div className="flex flex-col items-center justify-between gap-2 rounded-lg border border-dashed border-hairline bg-surface px-4 py-3 text-sm sm:flex-row">
      <span className="text-ink-muted">결과가 궁금하신 점이 있거나 활용법을 더 알고 싶으신가요?</span>
      <Link href="/board" className="shrink-0 font-semibold text-primary hover:underline">
        게시판에 물어보기 →
      </Link>
    </div>
  );
}
