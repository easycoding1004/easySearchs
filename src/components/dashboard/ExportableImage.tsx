"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

// 블로그지수 결과를 PNG로 저장 — 카톡 공유용. html-to-image는 실제 브라우저
// 렌더링을 그대로 캡처해서 html2canvas보다 최신 CSS(oklch, backdrop-filter
// 등)에 안전함.
export default function ExportableImage({
  children,
  fileName,
}: {
  children: React.ReactNode;
  fileName: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave() {
    if (!ref.current || saving) return;
    setSaving(true);
    setError(false);
    try {
      const dataUrl = await toPng(ref.current, {
        backgroundColor: "#fffbf7",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("[ExportableImage] export failed:", err);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        {error && <span className="text-xs text-error">이미지 저장에 실패했어요.</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface disabled:opacity-50"
        >
          {saving ? "저장 중..." : "이미지로 저장"}
        </button>
      </div>
      <div ref={ref} className="bg-bg">
        {children}
      </div>
    </div>
  );
}
