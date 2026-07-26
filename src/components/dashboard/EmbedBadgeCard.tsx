"use client";

import { useState } from "react";

const SITE_URL = "https://ezzsearch.com";

export default function EmbedBadgeCard({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  const badgeUrl = `${SITE_URL}/api/badge/${sessionId}`;
  const linkUrl = `${SITE_URL}/dashboard/${sessionId}`;
  const snippet = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer"><img src="${badgeUrl}" alt="ezzsearch 블로그지수" width="320" height="88" /></a>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access blocked — nothing to recover, button just won't
      // show the "복사됨" feedback.
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5">
      <div>
        <h2 className="text-base font-semibold text-ink">내 블로그에 배지 달기</h2>
        <p className="mt-1 text-sm text-ink-muted">
          아래 코드를 블로그에 붙여넣으면 블로그지수 배지가 표시돼요. 배지를 클릭하면 이
          결과 페이지로 연결됩니다.
        </p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={badgeUrl} alt="ezzsearch 블로그지수 배지 미리보기" width={320} height={88} />

      <div className="flex flex-col gap-2">
        <textarea
          readOnly
          value={snippet}
          onFocus={(e) => e.currentTarget.select()}
          rows={3}
          className="w-full resize-none rounded-md border border-hairline bg-bg p-3 font-mono text-xs text-ink-muted"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="self-start rounded-md border border-hairline px-4 py-2 text-sm font-medium text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97]"
        >
          {copied ? "복사됐어요" : "코드 복사"}
        </button>
      </div>
    </section>
  );
}
