"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";

// 2026-08 추가(사용자 요청 — "초안이 완성되면 블로그에서 보일 미리보기
// 기능이 있었으면 좋겠고") — 결과 카드 안의 미리보기는 편집 컨트롤에 둘러싸여
// 있어 실제 포스팅과는 거리가 있으니, 편집 UI 없이 본문만 넓게 보여주는
// 전용 화면을 모달로 띄운다. src/components/SearchProgressModal.tsx와 같은
// 패턴(createPortal(document.body) + fixed 오버레이)을 재사용 — 페이지
// 전환 애니메이션의 transform 조상이 fixed 요소를 가운데 정렬에서 벗어나게
// 만드는 문제를 그 파일과 같은 이유로 피한다.
export default function PreviewModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-surface p-6 shadow-lg sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-ink-muted">미리보기</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline px-3 py-1 text-xs font-semibold text-ink-muted transition hover:bg-bg"
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
