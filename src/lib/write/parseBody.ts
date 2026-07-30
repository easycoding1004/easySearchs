// Parses the lightweight markup blogWriter.ts instructs Claude to produce in
// "body" — "## " subheading lines, "**강조**" emphasis spans, and image
// placement tokens ([사진N] / [스톡이미지] / [AI이미지N]). Shared between the
// on-page preview render and the rich-HTML clipboard copy in
// BlogWriterForm.tsx, so both stay in sync with one parsing pass. No `fs`/
// server deps — safe to import from a client component.

export type BodyInline =
  | { type: "text"; text: string }
  | { type: "em"; text: string }
  | { type: "image"; token: string }; // "사진1", "스톡이미지", "AI이미지1", ...

export type BodyBlock = { type: "heading"; text: string } | { type: "paragraph"; inline: BodyInline[] };

const INLINE_RE = /\*\*(.+?)\*\*|\[(사진\d+|스톡이미지|AI이미지\d+)\]/g;

export function parseBody(body: string): BodyBlock[] {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs.map((p): BodyBlock => {
    if (p.startsWith("## ")) {
      return { type: "heading", text: p.slice(3).trim() };
    }

    const inline: BodyInline[] = [];
    let lastIndex = 0;
    for (const match of p.matchAll(INLINE_RE)) {
      const idx = match.index ?? 0;
      if (idx > lastIndex) inline.push({ type: "text", text: p.slice(lastIndex, idx) });
      if (match[1] !== undefined) {
        inline.push({ type: "em", text: match[1] });
      } else if (match[2] !== undefined) {
        inline.push({ type: "image", token: match[2] });
      }
      lastIndex = idx + match[0].length;
    }
    if (lastIndex < p.length) inline.push({ type: "text", text: p.slice(lastIndex) });

    return { type: "paragraph", inline };
  });
}

// "텍스트만 복사" 폴백 및 일일제한 안내 등에서 마크업 기호 없이 순수 텍스트만
// 필요할 때 사용.
export function stripBodyMarkup(body: string): string {
  return body
    .replace(/^## /gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[(사진\d+|스톡이미지|AI이미지\d+)\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 네이버 에디터에 서식이 그대로 붙여넣어지도록 clipboard의 text/html로 쓸
// HTML 문자열을 만든다 — 굵게/색상은 인라인 style과 <strong>/<h3> 시맨틱
// 태그를 같이 써서, 에디터가 style을 걸러내도 최소한 굵기·구조는 남게 함
// (실제 네이버 SmartEditor의 붙여넣기 정제 동작은 미검증 — best-effort).
export function renderBodyToHtml(blocks: BodyBlock[], resolveImage: ImageResolver): string {
  return blocks
    .map((block) => {
      if (block.type === "heading") {
        return `<h3 style="font-size:20px;font-weight:700;color:#c2410c;margin:20px 0 8px;">${escapeHtmlText(block.text)}</h3>`;
      }
      const inner = block.inline
        .map((piece) => {
          if (piece.type === "text") return escapeHtmlText(piece.text);
          if (piece.type === "em") {
            return `<strong style="color:#c2410c;font-weight:700;">${escapeHtmlText(piece.text)}</strong>`;
          }
          const resolved = resolveImage(piece.token);
          if (!resolved) return "";
          return `<br/><img src="${resolved.src}" alt="${escapeHtmlText(resolved.alt)}" style="max-width:100%;border-radius:8px;margin:8px 0;" /><br/>`;
        })
        .join("");
      return `<p style="margin:0 0 14px;line-height:1.7;">${inner}</p>`;
    })
    .join("\n");
}

export interface ResolvedImage {
  src: string;
  alt: string;
}

export type ImageResolver = (token: string) => ResolvedImage | null;

// 사진N은 업로드 순서로 바로 매핑되지만, 스톡이미지는 사용자가 클릭해서
// 끼워 넣은 순서대로 문서에 나오는 [스톡이미지] 자리에 차례로 채워야 하므로
// resolver를 함수 스코프의 mutable 카운터로 만들어 매 렌더마다 새로 생성한다.
export function createImageResolver(params: {
  photoSrcs: string[]; // index 0 = 사진1
  insertedStockImages: { webformatURL: string; query: string }[];
  aiImages: ({ dataUrl: string; prompt: string } | null)[]; // index 0 = AI이미지1
}): ImageResolver {
  let stockCursor = 0;
  return (token: string) => {
    const photoMatch = token.match(/^사진(\d+)$/);
    if (photoMatch) {
      const idx = Number(photoMatch[1]) - 1;
      const src = params.photoSrcs[idx];
      return src ? { src, alt: `사진 ${photoMatch[1]}` } : null;
    }

    if (token === "스톡이미지") {
      const img = params.insertedStockImages[stockCursor];
      stockCursor += 1;
      return img ? { src: img.webformatURL, alt: img.query } : null;
    }

    const aiMatch = token.match(/^AI이미지(\d+)$/);
    if (aiMatch) {
      const idx = Number(aiMatch[1]) - 1;
      const img = params.aiImages[idx];
      return img ? { src: img.dataUrl, alt: img.prompt } : null;
    }

    return null;
  };
}
