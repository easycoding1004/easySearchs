import type { BlogTheme } from "./blogTheme";

// v2 블록 포맷(2026-08, new_blog/ezzsearch-ai-draft-block-format-v2.md) 파서 —
// blogWriter.ts가 Claude에게 시키는 "## " 소제목, "- "/"1. " 목록, "**강조**"
// 인라인 마크업은 v1과 동일하지만, 이미지/영상/인용구/구분선/표/장소/링크는
// 더 이상 인라인 토큰([사진N] 등)이 아니라 독립된 블록 마크업
// `[[TAG: key=value | key2="value2" | ...]]`으로 표시됨. 화면 미리보기와
// clipboard용 HTML 렌더링(BlogWriterForm.tsx), 확장 프로그램으로 넘기는
// HTML(handleSendToExtension) 모두 이 파서 결과를 공유해서 마크업 해석이
// 항상 일치하게 함. No `fs`/서버 의존성 — 클라이언트 컴포넌트에서 안전하게
// import 가능.

export type BodyInline = { type: "text"; text: string } | { type: "em"; text: string };

// 이미지 계열 slot/gallery의 "종류" — 이미지(실제 업로드 사진)만 count>1(GALLERY)이
// 가능하고, 나머지는 늘 1개씩 순번이 매겨짐.
export type MediaKind = "이미지" | "영상" | "스톡이미지" | "AI이미지";

export interface SlotBlock {
  type: "slot";
  kind: MediaKind;
  count: number;
  roles: string[];
  photoIndices: number[]; // kind가 "이미지"일 때만 의미 있음(1부터 시작하는 업로드 순서)
  hint: string;
  // kind가 "스톡이미지"/"AI이미지"일 때, 문서 안에서 몇 번째 스톡/AI 슬롯인지
  // (1부터) — resolveImage가 stockImageQueries/aiImagePrompts 배열과 순서를
  //맞추는 데 씀. 파서가 채워 넣음(파싱 시점에 순서대로 카운트).
  mediaIndex: number;
}

export interface GalleryBlock {
  type: "gallery";
  kind: "이미지";
  count: number;
  layout: string; // 그리드 | 슬라이드 | 콜라주
  photoIndices: number[];
  hint: string;
}

export type BodyBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; inline: BodyInline[] }
  | { type: "list"; ordered: boolean; items: BodyInline[][] }
  | SlotBlock
  | GalleryBlock
  | { type: "quote"; text: string }
  | { type: "divider" }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "place"; name: string; hint: string }
  | { type: "link"; url: string; description: string };

const BULLET_RE = /^[-•]\s+/;
const NUMBERED_RE = /^\d+\.\s+/;
const EM_RE = /\*\*(.+?)\*\*/g;
// 전체 청크가 통째로 `[[TAG]]` 또는 `[[TAG: ...]]` 하나뿐인지 검사 — 여러 줄
// 힌트("...")를 감안해 [\s\S] 사용, 첫 `]]`에서 lazy하게 끊음(중첩 대괄호는
// 안 씀을 전제).
const BLOCK_RE = /^\[\[(\w+)(?::\s*([\s\S]*?))?\]\]$/;

function tokenizeInline(text: string): BodyInline[] {
  const inline: BodyInline[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(EM_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) inline.push({ type: "text", text: text.slice(lastIndex, idx) });
    inline.push({ type: "em", text: match[1] });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) inline.push({ type: "text", text: text.slice(lastIndex) });
  return inline;
}

// `A | B="c,d" | C` → ['A', 'B="c,d"', 'C'] — 따옴표 안의 |는 구분자로 안 침.
function splitPipeSegments(raw: string): string[] {
  return (raw.match(/(?:[^|"]|"[^"]*")+/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

function parseAttrsFromSegments(segments: string[]): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const seg of segments) {
    const eq = seg.indexOf("=");
    if (eq === -1) continue;
    const key = seg.slice(0, eq).trim();
    let value = seg.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    attrs[key] = value;
  }
  return attrs;
}

// "1,2,3" 또는 "4-12"(범위) 또는 둘을 섞은 "1,2,4-6" 형식을 1부터 시작하는
// 인덱스 배열로 변환.
function parsePhotoIndices(raw: string | undefined): number[] {
  if (!raw) return [];
  const indices: number[] = [];
  for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      for (let i = start; i <= end; i++) indices.push(i);
    } else if (/^\d+$/.test(part)) {
      indices.push(Number(part));
    }
  }
  return indices;
}

// mediaCounters — 파싱하는 동안 "스톡이미지"/"AI이미지" slot을 만날 때마다
// 1씩 증가시키는 카운터. 파서 호출 하나(parseBody 한 번 호출)에 국한된
// 지역 상태라 순서만 안정적이면 됨.
interface MediaCounters {
  스톡이미지: number;
  AI이미지: number;
}

// Claude가 "AI이미지"를 "AI 이미지"처럼 띄어서 쓰는 경우가 실제로 있었음
// (2026-08 사용자 신고 — "AI 이미지 생성이 안 된다" 버그의 원인. 공백이
// 섞인 채로 그대로 MediaKind로 캐스팅되면 이후 모든 "AI이미지" 리터럴 비교가
// 전부 실패해서, mediaIndex가 안 매겨지고 이미지가 실제로 생성돼도 절대
// 화면에 매칭이 안 됨). 내부 공백을 지우고 대소문자를 정규화해서 매칭한다.
function normalizeMediaKind(raw: string): MediaKind {
  const compact = raw.replace(/\s+/g, "");
  if (compact === "영상") return "영상";
  if (compact === "스톡이미지") return "스톡이미지";
  if (/^ai이미지$/i.test(compact)) return "AI이미지";
  return "이미지"; // 알 수 없는 값은 가장 흔한 경우로 안전하게 폴백
}

function parseSlotOrGallery(
  tag: "SLOT" | "GALLERY",
  content: string,
  counters: MediaCounters
): SlotBlock | GalleryBlock | null {
  const segments = splitPipeSegments(content);
  const kind = normalizeMediaKind(segments[0] ?? "");
  const attrs = parseAttrsFromSegments(segments.slice(1));
  const count = Number(attrs["개수"]) || 0;
  const hint = attrs["힌트"] || "";

  if (tag === "GALLERY") {
    if (kind !== "이미지") return null; // GALLERY는 실제 사진 대량 배치 전용
    return {
      type: "gallery",
      kind: "이미지",
      count,
      layout: attrs["배치"] || "그리드",
      photoIndices: parsePhotoIndices(attrs["사진"]),
      hint,
    };
  }

  const roles = attrs["역할"] ? attrs["역할"].split(",").map((s) => s.trim()) : [];
  let mediaIndex = 0;
  if (kind === "스톡이미지") {
    counters.스톡이미지 += 1;
    mediaIndex = counters.스톡이미지;
  } else if (kind === "AI이미지") {
    counters.AI이미지 += 1;
    mediaIndex = counters.AI이미지;
  }

  return {
    type: "slot",
    kind,
    count,
    roles,
    photoIndices: kind === "이미지" ? parsePhotoIndices(attrs["사진"]) : [],
    hint,
    mediaIndex,
  };
}

function parseSpecialBlock(tag: string, content: string, counters: MediaCounters): BodyBlock | null {
  switch (tag.toUpperCase()) {
    case "DIVIDER":
      return { type: "divider" };
    case "QUOTE": {
      const match = content.match(/^"([\s\S]*)"$/);
      return { type: "quote", text: (match ? match[1] : content).trim() };
    }
    case "SLOT":
      return parseSlotOrGallery("SLOT", content, counters);
    case "GALLERY":
      return parseSlotOrGallery("GALLERY", content, counters);
    case "TABLE": {
      const attrs = parseAttrsFromSegments(splitPipeSegments(content));
      const headers = (attrs["헤더"] || "").split(",").map((s) => s.trim());
      const rowKeys = Object.keys(attrs)
        .filter((k) => /^행\d+$/.test(k))
        .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
      const rows = rowKeys.map((k) => attrs[k].split(",").map((s) => s.trim()));
      return { type: "table", headers, rows };
    }
    case "PLACE": {
      const attrs = parseAttrsFromSegments(splitPipeSegments(content));
      return { type: "place", name: attrs["이름"] || "", hint: attrs["힌트"] || "" };
    }
    case "LINK": {
      const attrs = parseAttrsFromSegments(splitPipeSegments(content));
      return { type: "link", url: attrs["url"] || "", description: attrs["설명"] || "" };
    }
    default:
      return null;
  }
}

export function parseBody(body: string): BodyBlock[] {
  const chunks = body
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

  const counters: MediaCounters = { 스톡이미지: 0, AI이미지: 0 };
  const blocks: BodyBlock[] = [];

  for (const chunk of chunks) {
    const blockMatch = chunk.match(BLOCK_RE);
    if (blockMatch) {
      const special = parseSpecialBlock(blockMatch[1], blockMatch[2] ?? "", counters);
      if (special) {
        blocks.push(special);
        continue;
      }
      // 알 수 없는 태그거나 파싱 실패 — 안전하게 일반 문단으로 폴백(마크업이
      // 그대로 텍스트로 보이는 게, 블록을 통째로 잃어버리는 것보다 나음).
    }

    if (chunk.startsWith("## ")) {
      blocks.push({ type: "heading", text: chunk.slice(3).trim() });
      continue;
    }

    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0 && lines.every((l) => BULLET_RE.test(l))) {
      blocks.push({ type: "list", ordered: false, items: lines.map((l) => tokenizeInline(l.replace(BULLET_RE, ""))) });
      continue;
    }
    if (lines.length > 0 && lines.every((l) => NUMBERED_RE.test(l))) {
      blocks.push({ type: "list", ordered: true, items: lines.map((l) => tokenizeInline(l.replace(NUMBERED_RE, ""))) });
      continue;
    }

    blocks.push({ type: "paragraph", inline: tokenizeInline(chunk) });
  }

  return blocks;
}

// "텍스트만 복사" 폴백 — 마크업 기호 없이 읽을 수 있는 텍스트만 남김.
export function stripBodyMarkup(body: string): string {
  const blocks = parseBody(body);
  return blocks
    .map((block) => {
      if (block.type === "heading") return block.text;
      if (block.type === "divider") return "───";
      if (block.type === "quote") return `"${block.text}"`;
      if (block.type === "table") {
        return [block.headers.join(" | "), ...block.rows.map((r) => r.join(" | "))].join("\n");
      }
      if (block.type === "place") return `📍 ${block.name}`;
      if (block.type === "link") return `🔗 ${block.description}: ${block.url}`;
      if (block.type === "slot" || block.type === "gallery") return ""; // 이미지 자리 표시는 텍스트 버전에서 생략
      if (block.type === "list") {
        return block.items
          .map((item, i) => `${block.ordered ? `${i + 1}.` : "-"} ${item.map((p) => p.text).join("")}`)
          .join("\n");
      }
      return block.inline.map((p) => p.text).join("");
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const CIRCLED_DIGITS = [
  "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩",
  "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳",
];
export { CIRCLED_DIGITS };

// 16개 유형별 테마(blogTheme.ts)의 listMarker를 실제 마커 문자로 변환 —
// 순서 있는 목록(번호가 의미 있는 튜토리얼 단계 등)은 테마와 무관하게 항상
// 순번을 보존해야 하므로 원문자를 그대로 쓰고, 테마의 listMarker는 순서
// 없는 목록의 불릿 모양에만 적용한다(circle 테마는 애초에 순서 있는 목록
// 위주라 순서 없는 목록엔 기본 불릿으로 폴백).
export function getListMarkerSymbol(theme: BlogTheme, ordered: boolean, index: number): string {
  if (ordered) return CIRCLED_DIGITS[index] ?? `${index + 1}.`;
  switch (theme.listMarker) {
    case "arrow":
      return "▶";
    case "check":
      return "✓";
    case "circle":
      return "•";
    case "dash":
    default:
      return "–";
  }
}

function renderInlineToHtml(pieces: BodyInline[], theme: BlogTheme): string {
  return pieces
    .map((piece) => {
      if (piece.type !== "em") return escapeHtmlText(piece.text);
      const text = escapeHtmlText(piece.text);
      if (theme.emphasisStyle === "underline-accent") {
        return `<strong style="color:${theme.accent};font-weight:700;border-bottom:2px solid ${theme.accent};padding-bottom:1px;">${text}</strong>`;
      }
      return `<strong style="background:${theme.accentSoft};color:${theme.accent};font-weight:700;padding:0 3px;border-radius:3px;">${text}</strong>`;
    })
    .join("");
}

function mediaLabel(kind: MediaKind): string {
  if (kind === "이미지") return "사진";
  if (kind === "영상") return "영상";
  if (kind === "스톡이미지") return "스톡 이미지";
  return "AI 생성 이미지";
}

// 이미지 placeholder를 렌더링 — 붙여넣기(clipboard)용은 안내 문구(mark),
// 확장 프로그램용은 data-ezzsearch-token이 붙은 <img>(§CLAUDE.md 17.5).
// forExtension이 true면 kind가 "이미지"/"AI이미지"인 photoIndices/mediaIndex를
// 토큰으로 노출하고(자동 업로드 대상), "영상"/"스톡이미지"는 항상 안내
// 문구로만 남김(자동화 대상 아님).
function renderMediaPlaceholder(
  kind: MediaKind,
  photoIndices: number[],
  mediaIndex: number,
  hint: string,
  forExtension: boolean,
  theme: BlogTheme
): string {
  const noticeFor = (label: string) =>
    `<mark style="background:${theme.accentSoft};color:${theme.accent};padding:2px 8px;border-radius:4px;font-weight:700;">📷 ${escapeHtmlText(label)} 자리${hint ? ` — ${escapeHtmlText(hint)}` : ""} (직접 넣어주세요)</mark>`;

  if (kind === "이미지") {
    if (photoIndices.length === 0) return noticeFor("사진");
    return photoIndices
      .map((idx) => {
        const token = `사진${idx}`;
        if (forExtension) {
          return `<img data-ezzsearch-token="${token}" alt="${escapeHtmlText(hint || token)}" style="max-width:100%;" />`;
        }
        return noticeFor(`사진${idx}`);
      })
      .join(" ");
  }

  if (kind === "AI이미지") {
    const token = `AI이미지${mediaIndex}`;
    if (forExtension) {
      return `<img data-ezzsearch-token="${token}" alt="${escapeHtmlText(hint || token)}" style="max-width:100%;" />`;
    }
    return noticeFor(mediaLabel(kind));
  }

  // 영상 / 스톡이미지 — 확장에서도 자동화 대상 아님(§CLAUDE.md 17.5)
  return noticeFor(mediaLabel(kind));
}

// 소제목 렌더링 — 테마의 headingStyle 4종(underline/boxed/sideBar/plain)에
// 따라 완전히 다른 장식을 적용한다(§CLAUDE.md 16, "네이버 상위 블로그 톤을
// 유형별로 인용" 요청). underline만 기존 "◆" 접두사를 유지하고 나머지는 각자
// 다른 방식(박스/좌측 바/무장식 큰 글씨)으로 시선을 끌기 때문에 접두사가
// 중복이라 뺐다.
function renderHeadingHtml(theme: BlogTheme, text: string): string {
  const escaped = escapeHtmlText(text);
  const font = `font-family:${theme.headingFont};font-size:${theme.headingSize}px;`;
  if (theme.headingStyle === "boxed") {
    return `<h3 style="${font}font-weight:800;color:#fff;background:${theme.accent};display:inline-block;padding:6px 14px;border-radius:6px;margin:26px 0 12px;">${escaped}</h3>`;
  }
  if (theme.headingStyle === "sideBar") {
    return `<h3 style="${font}font-weight:800;color:${theme.accent};border-left:5px solid ${theme.accent};padding:2px 0 2px 12px;margin:26px 0 10px;">${escaped}</h3>`;
  }
  if (theme.headingStyle === "plain") {
    return `<h3 style="${font}font-weight:800;color:${theme.accent};margin:28px 0 10px;">${escaped}</h3>`;
  }
  return `<h3 style="${font}font-weight:800;color:${theme.accent};margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid ${theme.accentSoft};">◆ ${escaped}</h3>`;
}

// 인용구 렌더링 — 테마의 quoteStyle 3종(border/serif/highlight).
function renderQuoteHtml(theme: BlogTheme, text: string): string {
  const escaped = escapeHtmlText(text);
  if (theme.quoteStyle === "serif") {
    return `<blockquote style="margin:18px 0;padding:14px 20px;font-family:${theme.headingFont};font-style:italic;font-size:17px;color:${theme.accent};background:${theme.accentSoft};border-radius:8px;">“${escaped}”</blockquote>`;
  }
  if (theme.quoteStyle === "highlight") {
    return `<blockquote style="margin:16px 0;padding:12px 16px;font-weight:700;color:#1a1a1a;background:${theme.accentSoft};border-radius:6px;border-left:6px solid ${theme.accent};">${escaped}</blockquote>`;
  }
  return `<blockquote style="margin:16px 0;padding:10px 16px;border-left:4px solid ${theme.accent};background:${theme.accentSoft};color:#3d2e1f;font-style:italic;">${escaped}</blockquote>`;
}

function renderBlocksToHtml(blocks: BodyBlock[], forExtension: boolean, theme: BlogTheme): string {
  const bodyStyle = `font-family:${theme.bodyFont};line-height:${theme.lineHeight};`;
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return renderHeadingHtml(theme, block.text);
        case "list":
          return block.items
            .map((item, i) => {
              const marker = getListMarkerSymbol(theme, block.ordered, i);
              return `<p style="margin:0 0 8px;${bodyStyle}"><span style="color:${theme.accent};font-weight:700;margin-right:6px;">${marker}</span>${renderInlineToHtml(item, theme)}</p>`;
            })
            .join("\n");
        case "paragraph":
          return `<p style="margin:0 0 14px;${bodyStyle}">${renderInlineToHtml(block.inline, theme)}</p>`;
        case "divider":
          return `<hr style="border:none;border-top:2px solid ${theme.accentSoft};margin:20px 0;" />`;
        case "quote":
          return renderQuoteHtml(theme, block.text);
        case "table": {
          const head = `<tr>${block.headers.map((h) => `<th style="border:1px solid ${theme.accentSoft};padding:6px 10px;background:${theme.accentSoft};text-align:left;font-family:${theme.bodyFont};">${escapeHtmlText(h)}</th>`).join("")}</tr>`;
          const body = block.rows
            .map(
              (row) =>
                `<tr>${row.map((cell) => `<td style="border:1px solid ${theme.accentSoft};padding:6px 10px;font-family:${theme.bodyFont};">${escapeHtmlText(cell)}</td>`).join("")}</tr>`
            )
            .join("");
          return `<table style="border-collapse:collapse;width:100%;margin:14px 0;">${head}${body}</table>`;
        }
        case "place":
          return `<p style="margin:0 0 14px;${bodyStyle}">📍 <strong style="color:${theme.accent};">${escapeHtmlText(block.name)}</strong>${block.hint ? ` <span style="color:#8a7a6a;font-size:13px;">(${escapeHtmlText(block.hint)})</span>` : ""}</p>`;
        case "link":
          return `<p style="margin:0 0 14px;${bodyStyle}">🔗 <a href="${escapeHtmlText(block.url)}" style="color:${theme.accent};font-weight:700;">${escapeHtmlText(block.description || block.url)}</a></p>`;
        case "slot":
          return `<p style="margin:0 0 14px;">${renderMediaPlaceholder(block.kind, block.photoIndices, block.mediaIndex, block.hint, forExtension, theme)}</p>`;
        case "gallery":
          return `<p style="margin:0 0 14px;">${renderMediaPlaceholder(block.kind, block.photoIndices, 0, block.hint, forExtension, theme)}</p>`;
        default:
          return "";
      }
    })
    .join("\n");
}

// 네이버 에디터 "서식 포함 복사"용 — 사진 자리는 안내 문구로만 남김(직접
// 다운로드해 끼워 넣어야 함, §CLAUDE.md 16 참고). theme(blogTheme.ts)이
// 소제목·인용구·목록·강조 스타일을 16개 유형마다 다르게 입힌다.
export function renderBodyToHtml(blocks: BodyBlock[], theme: BlogTheme): string {
  return renderBlocksToHtml(blocks, false, theme);
}

// 크롬 확장으로 초안을 보낼 때 쓰는 버전 — 사진/AI이미지 자리를
// data-ezzsearch-token이 붙은 <img> 플레이스홀더로 렌더링해서, 확장이 실제
// 업로드한 네이버 CDN URL로 치환한 뒤 붙여넣을 수 있게 함(§CLAUDE.md 17.5).
export function renderBodyToHtmlForExtension(blocks: BodyBlock[], theme: BlogTheme): string {
  return renderBlocksToHtml(blocks, true, theme);
}

export interface ResolvedImage {
  src: string;
  alt: string;
}

// 화면 미리보기(React, 우리 페이지 안)에서 실제 이미지를 보여줄 때 씀 —
// "사진N"은 업로드 순서로 바로 매핑, "AI이미지N"/"스톡이미지N"은 파서가 매긴
// mediaIndex 순서와 stockImageQueries/aiImagePrompts·응답 배열 순서가
// 일치한다는 전제로 매핑한다(blogWriter.ts가 그 순서를 지켜서 응답함).
export function createImageResolver(params: {
  photoSrcs: string[]; // index 0 = 사진1
  stockImages: { webformatURL: string; query: string }[]; // index 0 = 문서상 첫 번째 스톡이미지 slot
  aiImages: ({ dataUrl: string; prompt: string } | null)[]; // index 0 = AI이미지1
}) {
  return (kind: MediaKind, photoIndex: number | null, mediaIndex: number): ResolvedImage | null => {
    if (kind === "이미지" && photoIndex != null) {
      const src = params.photoSrcs[photoIndex - 1];
      return src ? { src, alt: `사진 ${photoIndex}` } : null;
    }
    if (kind === "스톡이미지") {
      const img = params.stockImages[mediaIndex - 1];
      return img ? { src: img.webformatURL, alt: img.query } : null;
    }
    if (kind === "AI이미지") {
      const img = params.aiImages[mediaIndex - 1];
      return img ? { src: img.dataUrl, alt: img.prompt } : null;
    }
    return null;
  };
}
