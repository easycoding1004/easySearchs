// Parses the lightweight markup blogWriter.ts instructs Claude to produce in
// "body" — "## " subheading lines, "- "/"1. " list lines, "**강조**" emphasis
// spans, and image placement tokens ([사진N] / [스톡이미지] / [AI이미지N], each
// with an optional ": 캡션"). Shared between the on-page preview render and
// the rich-HTML clipboard copy in BlogWriterForm.tsx, so both stay in sync
// with one parsing pass. No `fs`/server deps — safe to import from a client
// component.

export type BodyInline =
  | { type: "text"; text: string }
  | { type: "em"; text: string }
  | { type: "image"; token: string; caption?: string }; // token: "사진1", "스톡이미지", "AI이미지1", ...

export type BodyBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; inline: BodyInline[] }
  | { type: "list"; ordered: boolean; items: BodyInline[][] };

// 실측 확인(2026-07): 네이버 스마트에디터 붙여넣기에서 <img>는 통째로
// 사라짐(글자만 들어감) — 그래서 클립보드 HTML에는 이미지를 절대 embed하지
// 않고, 대신 사용자가 화면 미리보기에서 다운로드해 직접 끼워 넣을 수 있게
// 안내 문구만 남긴다(renderBodyToHtml 참고). 화면 미리보기(React)는 우리
// 페이지 안에서 직접 렌더링하는 것이라 이 제약과 무관하게 실제 이미지를 보여줌.
export const CIRCLED_DIGITS = [
  "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩",
  "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳",
];

const INLINE_RE = /\*\*(.+?)\*\*|\[(사진\d+|스톡이미지|AI이미지\d+)(?::\s*([^\]]+))?\]/g;
const BULLET_RE = /^[-•]\s+/;
const NUMBERED_RE = /^\d+\.\s+/;

function tokenizeInline(text: string): BodyInline[] {
  const inline: BodyInline[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) inline.push({ type: "text", text: text.slice(lastIndex, idx) });
    if (match[1] !== undefined) {
      inline.push({ type: "em", text: match[1] });
    } else if (match[2] !== undefined) {
      inline.push({ type: "image", token: match[2], caption: match[3]?.trim() || undefined });
    }
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) inline.push({ type: "text", text: text.slice(lastIndex) });
  return inline;
}

export function parseBody(body: string): BodyBlock[] {
  const chunks = body
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

  return chunks.map((chunk): BodyBlock => {
    if (chunk.startsWith("## ")) {
      return { type: "heading", text: chunk.slice(3).trim() };
    }

    const lines = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length > 0 && lines.every((l) => BULLET_RE.test(l))) {
      return { type: "list", ordered: false, items: lines.map((l) => tokenizeInline(l.replace(BULLET_RE, ""))) };
    }
    if (lines.length > 0 && lines.every((l) => NUMBERED_RE.test(l))) {
      return { type: "list", ordered: true, items: lines.map((l) => tokenizeInline(l.replace(NUMBERED_RE, ""))) };
    }

    return { type: "paragraph", inline: tokenizeInline(chunk) };
  });
}

// "텍스트만 복사" 폴백에서 마크업 기호 없이 순수 텍스트만 필요할 때 사용.
export function stripBodyMarkup(body: string): string {
  return body
    .replace(/^## /gm, "")
    .replace(BULLET_RE, "")
    .replace(new RegExp(BULLET_RE.source, "gm"), "")
    .replace(new RegExp(NUMBERED_RE.source, "gm"), "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[(사진\d+|스톡이미지|AI이미지\d+)(?::\s*[^\]]+)?\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function describeImageToken(token: string): string {
  const photoMatch = token.match(/^사진(\d+)$/);
  if (photoMatch) return `사진 ${photoMatch[1]}`;
  if (token === "스톡이미지") return "스톡 이미지";
  const aiMatch = token.match(/^AI이미지(\d+)$/);
  if (aiMatch) return `AI 생성 이미지 ${aiMatch[1]}`;
  return "이미지";
}

function renderInlineToHtml(pieces: BodyInline[]): string {
  return pieces
    .map((piece) => {
      if (piece.type === "text") return escapeHtmlText(piece.text);
      if (piece.type === "em") {
        return `<strong style="background:#fed7aa;color:#9a3412;font-weight:700;padding:0 3px;border-radius:3px;">${escapeHtmlText(piece.text)}</strong>`;
      }
      const label = describeImageToken(piece.token) + (piece.caption ? ` — ${piece.caption}` : "");
      return `<mark style="background:#fed7aa;color:#9a3412;padding:2px 8px;border-radius:4px;font-weight:700;">📷 ${escapeHtmlText(label)} 자리 (사진을 직접 끼워 넣어주세요)</mark>`;
    })
    .join("");
}

// 네이버 에디터 붙여넣기용 HTML — 굵게/소제목/목록 서식은 살아남지만(실측
// 확인) 이미지는 <img>를 넣어도 통째로 사라지므로 아예 embed하지 않고
// 눈에 띄는 안내 문구(mark)로만 남긴다. 소제목엔 "◆", 목록엔 원문자(①②③)나
// "▶"를 붙여서 상위노출 블로그들이 흔히 쓰는 스타일에 가깝게 함.
export function renderBodyToHtml(blocks: BodyBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "heading") {
        return `<h3 style="font-size:20px;font-weight:800;color:#c2410c;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #fed7aa;">◆ ${escapeHtmlText(block.text)}</h3>`;
      }
      if (block.type === "list") {
        return block.items
          .map((item, i) => {
            const marker = block.ordered ? (CIRCLED_DIGITS[i] ?? `${i + 1}.`) : "▶";
            return `<p style="margin:0 0 8px;line-height:1.7;"><span style="color:#c2410c;font-weight:700;margin-right:6px;">${marker}</span>${renderInlineToHtml(item)}</p>`;
          })
          .join("\n");
      }
      return `<p style="margin:0 0 14px;line-height:1.7;">${renderInlineToHtml(block.inline)}</p>`;
    })
    .join("\n");
}

export interface ResolvedImage {
  src: string;
  alt: string;
}

export type ImageResolver = (token: string) => ResolvedImage | null;

// 화면 미리보기(React, 우리 페이지 안)에서 실제 이미지를 보여줄 때만 씀 —
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
