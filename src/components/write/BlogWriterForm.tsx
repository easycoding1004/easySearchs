"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BLOG_GROUPS,
  BLOG_CATEGORIES,
  getBlogCategoryMeta,
  type BlogGroup,
  type BlogCategory,
} from "@/lib/write/blogCategories";
import {
  parseBody,
  stripBodyMarkup,
  renderBodyToHtml,
  renderBodyToHtmlForExtension,
  createImageResolver,
  escapeHtmlText,
  getListMarkerSymbol,
  type BodyBlock,
  type BodyInline,
  type SlotBlock,
  type GalleryBlock,
} from "@/lib/write/parseBody";
import {
  getBlogTheme,
  applyThemeOverrides,
  ACCENT_PRESETS,
  FONT_OPTIONS,
  STYLE_PRESET_OPTIONS,
  type BlogTheme,
  type FontChoice,
  type StylePreset,
} from "@/lib/write/blogTheme";
import { readSseStream } from "@/lib/utils/readSseStream";
import KeywordSeoGauge, { type KeywordSeoEntry } from "@/components/write/KeywordSeoGauge";
import LowQualityRiskCard from "@/components/write/LowQualityRiskCard";
import PreviewModal from "@/components/write/PreviewModal";
// 타입만 가져옴(import type) — lowQualityRisk.ts의 실제 계산 함수는 서버
// 라우트에서만 돌고 클라이언트는 결과만 받아서 보여줌. type import는 빌드
// 시 완전히 지워지므로 blogWriter.ts(→fs 쓰는 blogRules.ts)가 클라이언트
// 번들에 실수로 섞여 들어가지 않음(blogCategories.ts/blogRules.ts 분리와
// 같은 원칙, §CLAUDE.md 16).
import type { LowQualityAssessment } from "@/lib/write/lowQualityRisk";
import type { TopRankFormatProfile } from "@/lib/write/topRankFormat";

// 2026-08 추가(사용자 요청 — "레이아웃 수정(선택지 3개)") — 본문 블록 구조
// (SLOT/GALLERY 배치)는 생성 시점에 Claude가 정한 그대로 고정돼 있어서,
// 레이아웃은 그 구조를 재배치하지 않고 "렌더링 방식"만 바꾼다(재생성 없이
// 미리보기에 즉시 반영). 사진은 애초에 붙여넣기/확장 전송에 실리지 않으므로
// (§CLAUDE.md 16) HTML 문자열 렌더러(parseBody.ts)는 건드리지 않고 이 파일의
// React 미리보기 렌더러에만 적용한다.
export type LayoutPreset = "표준형" | "매거진형" | "미니멀형";
const LAYOUT_PRESET_OPTIONS: LayoutPreset[] = ["표준형", "매거진형", "미니멀형"];

function layoutBodyGapClass(layout: LayoutPreset): string {
  if (layout === "매거진형") return "gap-3";
  if (layout === "미니멀형") return "gap-0.5";
  return "gap-1";
}

function layoutGalleryGridClass(layout: LayoutPreset): string {
  if (layout === "매거진형") return "grid grid-cols-3 gap-2 sm:grid-cols-4";
  if (layout === "미니멀형") return "grid grid-cols-2 gap-1.5";
  return "grid grid-cols-2 gap-2 sm:grid-cols-3";
}

// 2026-08 v2 개편(§CLAUDE.md 16.2) — GALLERY가 최대 50장까지 한 번에 요구할
// 수 있어 서버(route.ts)와 동일하게 상한을 올림. 원본 업로드 용량 sanity cap도
// 서버 값과 맞춤(실제 Claude 32MB 한도는 서버의 사진 압축 후 별도 검사).
const MAX_IMAGES = 50;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_TOTAL_IMAGE_BYTES = 200 * 1024 * 1024; // 200MB
// 서버(/api/write/revise/route.ts)와 같은 값 — 수정 요청 무한 반복으로 비용이
// 새는 걸 막는 상한. 새로 생성하면(handleSubmit) 0으로 초기화됨.
const MAX_REVISIONS = 5;
const MAX_INSTRUCTION_LENGTH = 300;

// 2026-08 추가(사용자 요청 — "게시에 적용한 글을 기반으로 앞으로 스타일을
// 미리 정해줬으면") — write/page.tsx가 이 사용자의 가장 최근 히스토리 1건에서
// 뽑아 서버에서 미리 계산해 넘겨주는 스타일 기본값. 히스토리가 없으면 전부
// null/기본값이라 지금까지의 하드코딩된 초기값과 동일하게 동작함.
export interface InitialStyleDefaults {
  stylePreset: StylePreset | null;
  layout: LayoutPreset;
  accentColor: string | null;
  font: FontChoice | null;
}

interface StockImage {
  query: string;
  webformatURL: string;
  pageURL: string;
}

interface AiImage {
  prompt: string;
  dataUrl: string;
}


interface WriteResult {
  title: string;
  body: string;
  recommendedThumbnail: number; // 0 = 없음
  thumbnailReason: string;
  tags: string[];
  category: BlogCategory;
  sponsored: boolean;
  stockImages: StockImage[];
  aiImages: (AiImage | null)[];
  lowQualityRisk: LowQualityAssessment;
  formatProfile: TopRankFormatProfile | null;
}

// 텍스트/강조 인라인만 렌더링 — v2부터 이미지는 더 이상 인라인 토큰이 아니라
// 블록 단위(SLOT/GALLERY)라 여기서는 이미지 처리를 하지 않는다. 강조(**)
// 스타일은 테마의 emphasisStyle(하이라이트 배경 vs 밑줄)에 따라 갈림 —
// blogTheme.ts 참고.
function renderInlineNodes(pieces: BodyInline[], keyPrefix: string, theme: BlogTheme) {
  return pieces.map((piece, j) => {
    const key = `${keyPrefix}-${j}`;
    if (piece.type === "em") {
      if (theme.emphasisStyle === "underline-accent") {
        return (
          <strong
            key={key}
            className="font-bold"
            style={{ color: theme.accent, borderBottom: `2px solid ${theme.accent}` }}
          >
            {piece.text}
          </strong>
        );
      }
      return (
        <strong
          key={key}
          className="rounded px-1 font-bold"
          style={{ background: theme.accentSoft, color: theme.accent }}
        >
          {piece.text}
        </strong>
      );
    }
    return <span key={key}>{piece.text}</span>;
  });
}

// 소제목 4종(underline/boxed/sideBar/plain) — HTML 문자열 렌더러
// (parseBody.ts의 renderHeadingHtml)와 같은 시각적 규칙을 React로 재현.
function renderHeadingNode(theme: BlogTheme, text: string, key: string) {
  const baseStyle: React.CSSProperties = {
    fontFamily: theme.headingFont,
    fontSize: theme.headingSize,
    fontWeight: 800,
    color: theme.accent,
  };
  if (theme.headingStyle === "boxed") {
    return (
      <h3
        key={key}
        className="mb-2 mt-3 inline-block rounded-md px-3 py-1"
        style={{ ...baseStyle, color: "#fff", background: theme.accent }}
      >
        {text}
      </h3>
    );
  }
  if (theme.headingStyle === "sideBar") {
    return (
      <h3 key={key} className="mb-2 mt-3 pl-3" style={{ ...baseStyle, borderLeft: `4px solid ${theme.accent}` }}>
        {text}
      </h3>
    );
  }
  if (theme.headingStyle === "plain") {
    return (
      <h3 key={key} className="mb-2 mt-3" style={baseStyle}>
        {text}
      </h3>
    );
  }
  return (
    <h3 key={key} className="mb-1 mt-2 border-b-2 pb-1" style={{ ...baseStyle, borderBottomColor: theme.accentSoft }}>
      ◆ {text}
    </h3>
  );
}

// 인용구 3종(border/serif/highlight).
function renderQuoteNode(theme: BlogTheme, text: string, key: string) {
  if (theme.quoteStyle === "serif") {
    return (
      <blockquote
        key={key}
        className="rounded-lg px-4 py-3 text-base italic"
        style={{ fontFamily: theme.headingFont, color: theme.accent, background: theme.accentSoft }}
      >
        “{text}”
      </blockquote>
    );
  }
  if (theme.quoteStyle === "highlight") {
    return (
      <blockquote
        key={key}
        className="rounded-md px-3 py-2 text-sm font-bold text-ink"
        style={{ background: theme.accentSoft, borderLeft: `5px solid ${theme.accent}` }}
      >
        {text}
      </blockquote>
    );
  }
  return (
    <blockquote
      key={key}
      className="px-3 py-2 text-sm italic text-ink"
      style={{ borderLeft: `4px solid ${theme.accent}`, background: theme.accentSoft }}
    >
      {text}
    </blockquote>
  );
}

function renderPhotoTile(src: string, alt: string, keyId: string) {
  return (
    <span key={keyId} className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block max-h-72 w-full rounded-md border border-hairline object-cover" />
      <a
        href={src}
        download={`${keyId}.png`}
        target={src.startsWith("data:") ? undefined : "_blank"}
        rel="noopener noreferrer"
        className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
      >
        이 사진 다운로드
      </a>
    </span>
  );
}

// SLOT/GALLERY 블록 렌더링 — 사진 SLOT/GALLERY는 실제 업로드 사진(photoIndices)을,
// 스톡이미지/AI이미지 SLOT은 mediaIndex로 매칭된 이미지를, 영상 SLOT은 자리
// 표시 문구만 보여준다(이 앱은 영상 파일 업로드를 다루지 않음).
function renderMediaBlock(
  block: SlotBlock | GalleryBlock,
  resolveImage: ReturnType<typeof createImageResolver>,
  key: string,
  layout: LayoutPreset
) {
  if (block.kind === "영상") {
    return (
      <div key={key} className="rounded-md bg-bg px-3 py-4 text-center text-xs text-ink-muted">
        🎬 영상 자리{block.hint ? ` — ${block.hint}` : ""} (직접 넣어주세요)
      </div>
    );
  }

  if (block.kind === "이미지") {
    if (block.photoIndices.length === 0) {
      return (
        <div key={key} className="rounded-md bg-bg px-3 py-4 text-center text-xs text-ink-muted">
          📷 사진 자리{block.hint ? ` — ${block.hint}` : ""}
        </div>
      );
    }
    return (
      <div key={key} className="flex flex-col gap-2">
        <div className={block.type === "gallery" ? layoutGalleryGridClass(layout) : "flex flex-col gap-2"}>
          {block.photoIndices.map((idx) => {
            const resolved = resolveImage("이미지", idx, 0);
            if (!resolved) {
              return (
                <span
                  key={`${key}-${idx}`}
                  className="flex items-center justify-center rounded bg-bg px-2 py-4 text-center text-xs text-ink-muted"
                >
                  [사진{idx} 자리 — 업로드 안 됨]
                </span>
              );
            }
            return renderPhotoTile(resolved.src, resolved.alt, `${key}-${idx}`);
          })}
        </div>
        {block.hint && <p className="text-center text-xs italic text-ink-muted">{block.hint}</p>}
      </div>
    );
  }

  // 스톡이미지 / AI이미지
  const resolved = resolveImage(block.kind, null, block.mediaIndex);
  if (!resolved) {
    return (
      <div key={key} className="rounded-md bg-bg px-3 py-4 text-center text-xs text-ink-muted">
        {block.kind === "스톡이미지"
          ? "🖼️ 스톡 이미지 자리 — 아래 추천 목록에서 골라주세요"
          : "✨ AI 이미지 자리 — 생성 중이거나 아직 준비되지 않았어요"}
      </div>
    );
  }
  return renderPhotoTile(resolved.src, resolved.alt, key);
}

function renderTableBlock(block: Extract<BodyBlock, { type: "table" }>, key: string, theme: BlogTheme) {
  return (
    <div key={key} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {block.headers.map((h, i) => (
              <th
                key={i}
                className="border border-hairline px-2 py-1 text-left font-semibold text-ink"
                style={{ background: theme.accentSoft }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-hairline px-2 py-1 text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderPreviewBlocks(
  blocks: BodyBlock[],
  resolveImage: ReturnType<typeof createImageResolver>,
  theme: BlogTheme,
  layout: LayoutPreset = "표준형"
) {
  const bodyStyle: React.CSSProperties = { fontFamily: theme.bodyFont, lineHeight: theme.lineHeight };
  return blocks.map((block, i) => {
    const key = `${i}`;
    switch (block.type) {
      case "heading":
        return renderHeadingNode(theme, block.text, key);
      case "list":
        return (
          <div key={key} className="flex flex-col gap-1">
            {block.items.map((item, idx) => (
              <p key={idx} className="whitespace-pre-wrap text-sm text-ink" style={bodyStyle}>
                <span className="mr-1.5 font-bold" style={{ color: theme.accent }}>
                  {getListMarkerSymbol(theme, block.ordered, idx)}
                </span>
                {renderInlineNodes(item, `${key}-${idx}`, theme)}
              </p>
            ))}
          </div>
        );
      case "paragraph":
        return (
          <p key={key} className="whitespace-pre-wrap text-sm text-ink" style={bodyStyle}>
            {renderInlineNodes(block.inline, key, theme)}
          </p>
        );
      case "divider":
        return <hr key={key} className="my-2 border-t-2" style={{ borderColor: theme.accentSoft }} />;
      case "quote":
        return renderQuoteNode(theme, block.text, key);
      case "table":
        return renderTableBlock(block, key, theme);
      case "place":
        return (
          <p key={key} className="text-sm text-ink">
            📍 <strong style={{ color: theme.accent }}>{block.name}</strong>
            {block.hint && <span className="ml-1 text-xs text-ink-muted">({block.hint})</span>}
          </p>
        );
      case "link":
        return (
          <p key={key} className="text-sm text-ink">
            🔗{" "}
            <a
              href={block.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline"
              style={{ color: theme.accent }}
            >
              {block.description || block.url}
            </a>
          </p>
        );
      case "slot":
      case "gallery":
        return renderMediaBlock(block, resolveImage, key, layout);
      default:
        return null;
    }
  });
}

export default function BlogWriterForm({
  email,
  hasUsedToday,
  isAdmin,
  naverBlogId: initialNaverBlogId,
  initialStyleDefaults,
}: {
  email: string;
  hasUsedToday: boolean;
  isAdmin: boolean;
  naverBlogId: string;
  initialStyleDefaults?: InitialStyleDefaults;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  // 2026-08 추가(사용자 요청 — "노출순위 높은 블로그를 스크래핑해서 16가지
  // 형태의 기본 포맷으로 설정") — 선택 입력. 채우면 서버가 그 키워드의
  // 네이버 상위 노출 블로그 글 형태(구조 통계만, 실제 문장 아님)를 참고해서
  // 글의 분량·구성을 맞춤. 비워두면 이 기능 자체를 건너뜀.
  const [keyword, setKeyword] = useState("");
  const [group, setGroup] = useState<BlogGroup | null>(null);
  const [category, setCategory] = useState<BlogCategory | null>(null);
  const [sponsored, setSponsored] = useState(false);
  // 2026-08 추가 — 유형 선택과 별개로 색상·폰트를 직접 고를 수 있는 선택
  // 사항. null이면 유형 기본값을 그대로 씀. 순수 렌더링 설정이라(Claude에
  // 보내는 프롬프트와 무관) 결과가 이미 생성된 뒤에 바꿔도 재생성 없이
  // 바로 미리보기에 반영됨. 초기값은 initialStyleDefaults(과거 히스토리
  // 기반 — 없으면 전부 null/기본값)에서 가져와 "스타일을 미리 정해줌"을
  // 구현함(2026-08, 사용자 요청).
  const [customAccent, setCustomAccent] = useState<string | null>(initialStyleDefaults?.accentColor ?? null);
  const [customFont, setCustomFont] = useState<FontChoice | null>(initialStyleDefaults?.font ?? null);
  // 2026-08 추가(사용자 요청 — "워드프레스나 티스토리 스타일 선택") — 색상·
  // 폰트와 마찬가지로 순수 렌더링 오버라이드, 재생성 없이 미리보기에 바로 반영됨.
  const [stylePreset, setStylePreset] = useState<StylePreset | null>(initialStyleDefaults?.stylePreset ?? null);
  // 2026-08 추가(사용자 요청 — "레이아웃 수정(선택지 3개)") — 본문 구조는
  // 그대로 두고 렌더링 방식만 바꾸는 프리셋(위 LAYOUT_PRESET_OPTIONS 참고).
  const [layout, setLayout] = useState<LayoutPreset>(initialStyleDefaults?.layout ?? "표준형");
  // 2026-08 추가(사용자 요청 — "최종 수정후 선택 하는 구조로 변경") — 결과가
  // 나오면 우선 "조정 모드"(스타일·레이아웃·사진 순서·수정 요청·SEO 게이지)로
  // 시작하고, 사용자가 명시적으로 확정해야 복사·확장 전송 버튼이 있는 최종
  // 화면으로 넘어간다. 새 글 생성/수정 요청이 성공할 때마다 다시 조정
  // 모드로 리셋됨(내용이 바뀌었으니 다시 검토할 기회를 줌).
  const [finalized, setFinalized] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  function resolveTheme(cat: BlogCategory): BlogTheme {
    return applyThemeOverrides(getBlogTheme(cat), { accent: customAccent, font: customFont, style: stylePreset });
  }
  const [loading, setLoading] = useState(false);
  // /api/write가 SSE로 진행 상태를 스트리밍함(2026-08 — 진행바 요청 대응) —
  // percent/label은 텍스트가 준비되기 전까지만 쓰고, 텍스트가 도착하면
  // 바로 결과 카드를 보여주므로 progress는 null로 돌려 숨긴다.
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  // 글 텍스트(제목·본문 등)는 이미 도착해서 result가 채워졌지만, 스톡·AI
  // 이미지는 아직 준비 중인 구간 — 이때는 결과 카드를 이미 보여주면서 이미지
  // 영역에만 "준비 중" 표시를 한다(사용자 요청 — "이미지 생성이 완료될 경우
  // 페이지를 보여주는게 좋겠어"를 반대로 뒤집어서, 텍스트는 먼저 보여주고
  // 이미지만 늦게 채워 넣는 쪽으로 구현).
  const [imagesLoading, setImagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [richCopied, setRichCopied] = useState(false);
  const [plainCopied, setPlainCopied] = useState(false);
  const [copiedTagIndex, setCopiedTagIndex] = useState<number | null>(null);
  const [extensionStatus, setExtensionStatus] = useState<"idle" | "sent" | "not-found">("idle");

  // 생성된 글에 대한 수정 요청 — 새 원본 생성(handleSubmit)마다 0으로 초기화됨.
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [revisionCount, setRevisionCount] = useState(0);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  // 사용자가 "추천 스톡 이미지"를 클릭해서 본문의 스톡이미지 SLOT 자리에
  // 끼워 넣은 것들 — 클릭한 순서대로 문서에 나오는 자리에 차례로 채워짐.
  const [insertedStockImages, setInsertedStockImages] = useState<StockImage[]>([]);

  // 2026-08 추가(사용자 요청 — "SEO 노출도 분석, 키워드 경쟁도를 게이지바로
  // 절대값 기준으로") — 실제 네이버 검색광고 API 데이터(자체 계산 점수 아님).
  // 스타일·레이아웃·사진 순서는 검색량·경쟁도에 영향이 없으므로 그 값이
  // 바뀔 때는 재조회하지 않고, 태그가 바뀔 수 있는 시점(최초 생성 직후,
  // 수정 요청 성공 직후)에만 fetchKeywordSeo를 호출한다.
  const [seoData, setSeoData] = useState<KeywordSeoEntry[] | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);

  async function fetchKeywordSeo(tags: string[]) {
    const keywords = tags.slice(0, 3);
    if (keywords.length === 0) {
      setSeoData([]);
      return;
    }
    setSeoLoading(true);
    try {
      const res = await fetch("/api/write/keyword-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });
      if (!res.ok) {
        setSeoData(null);
        return;
      }
      const data = await res.json();
      setSeoData(Array.isArray(data.results) ? data.results : null);
    } catch {
      setSeoData(null);
    } finally {
      setSeoLoading(false);
    }
  }

  const [naverBlogId, setNaverBlogId] = useState(initialNaverBlogId);
  const [editingBlogId, setEditingBlogId] = useState(false);
  const [blogIdDraft, setBlogIdDraft] = useState(initialNaverBlogId);
  const [savingBlogId, setSavingBlogId] = useState(false);

  // files가 그대로면 재사용 — 매 렌더(프롬프트 타이핑 등)마다 새 blob URL을
  // 계속 만들어내던 걸 방지(메모리 누수는 아니지만 낭비였음).
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  const selectedMeta = category ? getBlogCategoryMeta(category) : null;
  const selectedTheme = category ? resolveTheme(category) : null;
  // 예시 미리보기용 — 아직 사진을 업로드하기 전(유형 선택 단계)이라 이미지
  // 자리는 없음(sampleBody가 SLOT/GALLERY를 안 씀), 그래도 resolver 타입은
  // 맞춰줘야 해서 빈 값으로 생성.
  const sampleResolveImage = createImageResolver({ photoSrcs: [], stockImages: [], aiImages: [] });
  const sampleBlocks = selectedMeta ? parseBody(selectedMeta.sampleBody) : [];

  // 사용자 신고(2026-08) — "AI가 작성한 블로그 글이 갑자기 화면에서
  // 사라지는" 버그의 원인: 사진 입력을 다시 클릭할 때마다(수정 요청을 위해
  // 사진을 추가/변경하려는 경우 등) result를 무조건 null로 지워버리고
  // 있었음 — 이미 생성된 글을 보고 있는 도중에 파일 입력을 건드리면 아무
  // 경고 없이 결과 전체가 사라짐. 새 글 생성은 handleSubmit이, 수정
  // 반영은 handleRevise가 각자 책임지고 result를 갱신하므로, 여기서는
  // 더 이상 결과를 지우지 않는다.
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES);
    setFiles(selected);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  async function handleSaveBlogId() {
    setSavingBlogId(true);
    try {
      const res = await fetch("/api/write/naver-blog-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naverBlogId: blogIdDraft.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNaverBlogId(data.naverBlogId);
        setEditingBlogId(false);
      }
    } finally {
      setSavingBlogId(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || !category || loading || hasUsedToday) return;

    for (const f of files) {
      if (f.size > MAX_IMAGE_BYTES) {
        setError("사진 1장의 용량은 15MB를 넘을 수 없어요.");
        return;
      }
    }
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      setError("사진 전체 용량이 너무 커요. 사진 개수를 줄여서 다시 시도해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setInsertedStockImages([]);
    setRevisionCount(0);
    setRevisionInstruction("");
    setRevisionError(null);
    setProgress({ percent: 5, label: "준비하고 있어요..." });
    setImagesLoading(false);
    setFinalized(false);
    setSeoData(null);

    try {
      const formData = new FormData();
      formData.set("prompt", prompt.trim());
      formData.set("category", category);
      formData.set("sponsored", String(sponsored));
      formData.set("keyword", keyword.trim());
      for (const file of files) formData.append("images", file);

      const res = await fetch("/api/write", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "글 생성에 실패했어요.");
        return;
      }

      let textReady = false;
      await readSseStream(res, (data) => {
        if (typeof data.error === "string") {
          setError(data.error);
          return;
        }
        if (data.textReady) {
          textReady = true;
          setResult({
            title: data.title as string,
            body: data.body as string,
            recommendedThumbnail: data.recommendedThumbnail as number,
            thumbnailReason: data.thumbnailReason as string,
            tags: data.tags as string[],
            category: data.category as BlogCategory,
            sponsored: data.sponsored as boolean,
            stockImages: [],
            aiImages: [],
            lowQualityRisk: data.lowQualityRisk as LowQualityAssessment,
            formatProfile: (data.formatProfile as TopRankFormatProfile | null) ?? null,
          });
          setProgress(null);
          setImagesLoading(true);
          fetchKeywordSeo((data.tags as string[]) ?? []);
          return;
        }
        if (data.done) {
          setImagesLoading(false);
          if (textReady) {
            setResult((prev) =>
              prev
                ? {
                    ...prev,
                    stockImages: (data.stockImages as StockImage[]) ?? [],
                    aiImages: (data.aiImages as (AiImage | null)[]) ?? [],
                  }
                : prev
            );
          }
          return;
        }
        setProgress({
          percent: typeof data.progress === "number" ? data.progress : 0,
          label: typeof data.status === "string" ? data.status : "처리하고 있어요...",
        });
      });
      if (!textReady) return; // 스트림이 error 이벤트 없이 그냥 끊긴 경우 — 이미 위에서 에러가 안 잡혔으면 그냥 조용히 종료
      // 2026-08 — 예전엔 여기서 router.refresh()로 hasUsedToday를 다시 계산해
      // 왔는데, 그 왕복(약 1초) 동안 /write/page.tsx의 `user &&
      // user.emailVerified` 분기가 세션 조회 타이밍에 따라 순간적으로
      // false가 되면 BlogWriterForm 자체가 통째로 언마운트돼서 방금 만든
      // result가 사라지는 버그로 이어졌을 가능성이 높음("AI 글이 생성되다가
      // 1초 뒤에 사라짐" 신고와 정확히 일치하는 타이밍). 지금은
      // TEMP_DISABLE_DAILY_LIMIT이 켜져 있어 hasUsedToday를 새로 받아와도
      // 어차피 항상 false라 이 refresh 자체가 무의미하기도 함 — 그래서 뺌.
      // 나중에 하루 1회 제한을 되살릴 때는 이 refresh를 되살리기보다, 언마운트
      // 위험이 없는 더 가벼운 방법(예: hasUsedToday만 별도 API로 조회)을
      // 고려할 것.
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  // 이미 생성된 글에 "제목을 더 짧게", "3번째 문단 빼줘" 같은 수정을 반영—
  // /api/write와 별도 라우트라 하루 1회 제한과 무관하게 쓸 수 있지만, 대신
  // 이 글 하나당 MAX_REVISIONS번까지만 되도록 서버가 다시 검증함.
  async function handleRevise() {
    if (!result || !revisionInstruction.trim() || revising || (!isAdmin && revisionCount >= MAX_REVISIONS)) return;

    setRevising(true);
    setRevisionError(null);

    try {
      const formData = new FormData();
      formData.set("instruction", revisionInstruction.trim());
      formData.set("category", result.category);
      formData.set("sponsored", String(result.sponsored));
      formData.set("keyword", keyword.trim());
      formData.set("revisionCount", String(revisionCount));
      formData.set(
        "previousResult",
        JSON.stringify({ title: result.title, body: result.body, tags: result.tags })
      );
      for (const file of files) formData.append("images", file);

      const res = await fetch("/api/write/revise", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setRevisionError(data.error ?? "수정에 실패했어요.");
        return;
      }

      setResult(data);
      setInsertedStockImages([]); // 본문이 바뀌었으니 이전 스톡이미지 삽입 자리는 무효화
      setRevisionCount((c) => c + 1);
      setRevisionInstruction("");
      setFinalized(false); // 내용이 바뀌었으니 다시 검토할 기회를 줌
      fetchKeywordSeo(data.tags ?? []);
    } catch {
      setRevisionError("네트워크 오류가 발생했어요.");
    } finally {
      setRevising(false);
    }
  }

  function handleToggleStockImage(img: StockImage) {
    setInsertedStockImages((prev) => {
      const exists = prev.some((p) => p.webformatURL === img.webformatURL);
      if (exists) return prev.filter((p) => p.webformatURL !== img.webformatURL);
      return [...prev, img];
    });
  }

  // 2026-08 사용자 신고("본문 복사에 태그가 반영되지 않았어") — 태그 배지를
  // 하나씩 클릭해서 복사하는 흐름(handleCopySingleTag, 네이버 태그 입력창이
  // 쉼표 붙여넣기를 못 받아서 생긴 우회)과는 별개로, 본문 자체를 복사할 때
  // 해시태그 한 줄을 맨 끝에 같이 넣어달라는 요청 — 많은 네이버 블로그가
  // 태그 입력창과 별개로 본문 끝에도 해시태그를 적어두는 관행과 일치함.
  // 기술적으로 막혀있던 게 아니라 단순히 안 넣고 있었던 것이라 바로 추가함.
  function tagsAsText(tags: string[]): string {
    return tags.length > 0 ? `\n\n${tags.map((t) => `#${t}`).join(" ")}` : "";
  }

  async function handleCopyPlain() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        `${result.title}\n\n${stripBodyMarkup(result.body)}${tagsAsText(result.tags)}`
      );
      setPlainCopied(true);
      setTimeout(() => setPlainCopied(false), 2000);
    } catch {
      // Clipboard access blocked — no feedback to show.
    }
  }

  // 2026-08 추가(사용자 요청 — "게시에 적용한 글들을 히스토리로 저장") — "이
  // 버전으로 확정하기"를 눌러야 복사/확장전송/네이버열기 버튼이 있는 확정
  // 화면으로 넘어가므로, 이 클릭을 "실제로 쓸 글을 정했다"는 신호로 보고
  // 히스토리에 저장한다. fire-and-forget — 저장이 실패해도(로그만 남김)
  // 확정 화면 전환 자체는 항상 진행됨(사용자 흐름을 막지 않음, naver-blog-id
  // 저장과 같은 원칙).
  function handleFinalize() {
    setFinalized(true);
    if (!result) return;
    const theme = resolveTheme(result.category);
    fetch("/api/write/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: result.title,
        body: result.body,
        tags: result.tags,
        category: result.category,
        sponsored: result.sponsored,
        stylePreset,
        layout,
        accentColor: customAccent ?? theme.accent,
        font: customFont,
      }),
    }).catch(() => {
      // 무시 — 히스토리 저장은 부가 기능, 실패해도 사용자에게 알리지 않음.
    });
  }

  // 네이버 에디터에 붙여넣을 때 굵게/소제목/목록 서식이 살아 있도록 text/html도
  // 같이 써넣는다(실측 확인: 이 서식 자체는 붙여넣기에서 유지됨). 이미지는
  // <img>를 넣어도 붙여넣기에서 통째로 사라지는 게 실측 확인돼서(글자만
  // 들어감), renderBodyToHtml이 아예 embed하지 않고 안내 문구만 남김 — 실제
  // 사진은 미리보기의 "이 사진 다운로드"로 받아서 직접 끼워 넣어야 함.
  async function handleCopyRich() {
    if (!result) return;
    try {
      const theme = resolveTheme(result.category);
      const blocks = parseBody(result.body);
      const tagsHtml =
        result.tags.length > 0
          ? `<p style="margin-top:16px;font-weight:600;color:${theme.accent};">${result.tags
              .map((t) => `#${escapeHtmlText(t)}`)
              .join(" ")}</p>`
          : "";
      const html = `<h2 style="font-family:${theme.headingFont};font-size:24px;font-weight:800;margin:0 0 16px;">${escapeHtmlText(result.title)}</h2>\n${renderBodyToHtml(blocks, theme)}${tagsHtml}`;
      const plain = `${result.title}\n\n${stripBodyMarkup(result.body)}${tagsAsText(result.tags)}`;

      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setRichCopied(true);
      setTimeout(() => setRichCopied(false), 2000);
    } catch {
      // Clipboard access blocked — no feedback to show.
    }
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // 크롬 확장(2026-08 추가, 2026-08 자동화 강화)으로 초안을 넘겨서, 네이버
  // 블로그 에디터 탭에 자동으로 붙여넣기가 되게 함 — window.postMessage로만
  // 통신하고 확장 ID를 이 코드가 알 필요는 없음(확장이 설치돼 있으면 write
  // 페이지에 심어둔 content script가 이 메시지를 받아 자기 background로
  // 중계함). 확장이 없으면 아무도 안 받으니, 짧은 시간 안에 ACK가 안 오면
  // "설치 안 된 것 같다"고 안내함.
  //
  // 사용자 요청("로그인 사용자에 대해 자동으로 블로그 에디터에 복사
  // 붙여넣기가 되었으면") — 예전엔 이 버튼을 누른 뒤 사용자가 직접
  // "네이버 블로그 글쓰기 열기"를 따로 눌러야 했는데, naverBlogId가 저장돼
  // 있으면 이 버튼 하나로 에디터 탭까지 자동으로 열어줌(그 탭 안에서
  // 실제 삽입은 content-editor.js가 자동으로 시도함). **탭은 반드시
  // await 이전, 클릭 핸들러 맨 앞에서 동기적으로 열어야 함** — ACK를 받은
  // 뒤(비동기) window.open을 호출하면 사용자 제스처 컨텍스트를 벗어나서
  // 브라우저 팝업 차단에 걸리기 쉬움. 그래서 일단 빈 탭을 열어두고, 실제
  // 이동은 ACK 성공 시(onAck)에, 확장이 없으면(타임아웃) 그 빈 탭을 다시
  // 닫아서 쓸모없는 빈 탭이 안 남게 함.
  //
  // html은 renderBodyToHtml(서식 포함 복사와 동일)이 아니라
  // renderBodyToHtmlForExtension을 씀 — 사진/AI이미지 자리가 안내 문구
  // 대신 <img data-ezzsearch-token> 플레이스홀더로 남아서, 확장이 실제
  // 네이버 CDN에 재업로드한 뒤 그 자리를 채워 넣을 수 있게 함(§CLAUDE.md
  // 17.5). 사진은 File을 base64로 읽어서 같이 보냄 — blob: URL은 이
  // 탭에서만 유효해서 확장(다른 탭)에 그대로 못 넘김. 스톡이미지는 이번
  // 범위에서 자동 삽입 대상이 아니라 images에 안 담음(기존처럼 안내
  // 문구로 남음).
  async function handleSendToExtension() {
    if (!result) return;
    const editorTab = naverBlogId ? window.open("about:blank", "_blank") : null;

    const theme = resolveTheme(result.category);
    const blocks = parseBody(result.body);
    const bodyHtml = renderBodyToHtmlForExtension(blocks, theme);
    const html = `<h2 style="font-family:${theme.headingFont};font-size:24px;font-weight:800;margin:0 0 16px;">${escapeHtmlText(result.title)}</h2>\n${bodyHtml}`;

    const images: Record<string, string> = {};
    await Promise.all(
      files.map(async (file, i) => {
        try {
          images[`사진${i + 1}`] = await readFileAsDataUrl(file);
        } catch {
          // 이 사진 하나만 자동 삽입에서 빠짐 — 나머지는 계속 진행.
        }
      })
    );
    result.aiImages.forEach((img, i) => {
      if (img) images[`AI이미지${i + 1}`] = img.dataUrl;
    });

    function onAck(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data?.source !== "ezzsearch-extension" || event.data?.type !== "DRAFT_ACK") return;
      window.removeEventListener("message", onAck);
      clearTimeout(softTimeoutId);
      clearTimeout(hardTimeoutId);
      setExtensionStatus("sent");
      setTimeout(() => setExtensionStatus("idle"), 3000);
      if (editorTab && naverBlogId) {
        editorTab.location.href = `https://blog.naver.com/${naverBlogId}?Redirect=Write&`;
      }
    }
    window.addEventListener("message", onAck);
    // 사용자 실사용 신고(2026-08): 반복 사용 시(특히 두 번째 시도부터)
    // "설치 안 된 것 같다"는 경고가 뜨고 방금 연 탭이 about:blank로 남아있는
    // 사례가 계속 보고됨 — MV3 서비스워커가 이전 요청(CDP 작업 등) 직후라
    // ACK 응답이 2500ms를 넘기는 경우가 실제로 있는 것으로 보임. 그렇다고
    // 무작정 타임아웃만 늘리면 진짜 미설치 상태에서 사용자가 오래 기다리게
    // 되므로, 두 단계로 나눔: 소프트 타임아웃(2500ms)에서는 "설치 안 된 것
    // 같다" 안내만 보여주고 리스너는 안 지움 — 그 뒤에라도 ACK가 오면
    // onAck이 정상 처리하고 상태를 "sent"로 되돌림(탭도 정상 이동). 리스너
    // 자체는 하드 타임아웃(8000ms)까지 살려둠 — 정말 그때까지도 안 오면
    // 그제서야 포기하고 정리함.
    const softTimeoutId = setTimeout(() => {
      setExtensionStatus("not-found");
      setTimeout(() => setExtensionStatus("idle"), 4000);
    }, 2500);
    const hardTimeoutId = setTimeout(() => {
      window.removeEventListener("message", onAck);
      // 2026-08 사용자 신고("새 창이 열리다가 꺼진다") — 여기서 editorTab을
      // 직접 닫아주던 게 원인이었음(그 버그는 고침). 확장이 실제로 없는
      // 경우에도 탭을 억지로 닫는 것보다는 빈 탭 하나 남는 게(사용자가
      // 직접 닫으면 됨) 훨씬 덜 disruptive해서, 더 이상 여기서 탭을 닫지
      // 않음.
    }, 8000);

    window.postMessage(
      {
        source: "ezzsearch-write",
        type: "SEND_DRAFT",
        payload: { title: result.title, html, tags: result.tags, images },
      },
      window.location.origin
    );
  }

  // 태그는 한 번에 여러 개를 붙여넣을 수 없음 — 네이버 태그 입력창은 쉼표나
  // Enter 키 입력 이벤트로만 태그를 분리 인식하고, 붙여넣기로 들어온 텍스트는
  // 쉼표까지 포함해서 통째로 태그 하나로 인식됨(사용자 실측 확인). 그래서
  // 태그를 한 번에 다 복사하는 대신, 하나씩 클릭해서 복사 → 붙여넣기 →
  // Enter를 반복하도록 UI를 바꿈.
  async function handleCopySingleTag(tag: string, index: number) {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiedTagIndex(index);
      setTimeout(() => setCopiedTagIndex((cur) => (cur === index ? null : cur)), 1500);
    } catch {
      // Clipboard access blocked — no feedback to show.
    }
  }

  const resultBlocks = result ? parseBody(result.body) : [];
  const resultMeta = result ? getBlogCategoryMeta(result.category) : null;
  const resultTheme = result ? resolveTheme(result.category) : null;
  const resultResolveImage = result
    ? createImageResolver({ photoSrcs: previews, stockImages: insertedStockImages, aiImages: result.aiImages })
    : null;

  // 2026-08 추가(사용자 요청 — "사진이 들어갈 배치 변경") — 본문의
  // [[GALLERY: 사진=1,3,5]] 같은 지정은 "업로드 순서 번호"를 참조하므로,
  // 파싱된 본문을 건드리지 않고 files(→previews) 순서만 바꾸면 이미 배정된
  // 자리에 다른 실제 사진이 즉시 반영된다.
  function movePhoto(index: number, direction: -1 | 1) {
    setFiles((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // 결과 카드 인라인 미리보기와 "미리보기" 모달이 같은 렌더링을 공유 —
  // 레이아웃 프리셋(매거진형 히어로 이미지·그리드 컬럼 등)이 둘 다에
  // 일관되게 반영되게 함.
  function renderArticle() {
    if (!result || !resultTheme || !resultResolveImage) return null;
    return (
      <>
        <p className="text-lg font-bold text-ink" style={{ fontFamily: resultTheme.headingFont }}>
          {result.title}
          {result.sponsored && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-800">
              협찬
            </span>
          )}
        </p>
        {layout === "매거진형" && result.recommendedThumbnail > 0 && previews[result.recommendedThumbnail - 1] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previews[result.recommendedThumbnail - 1]}
            alt="대표 이미지"
            className="max-h-80 w-full rounded-lg border border-hairline object-cover"
          />
        )}
        <div className={`flex flex-col ${layoutBodyGapClass(layout)}`}>
          {renderPreviewBlocks(resultBlocks, resultResolveImage, resultTheme, layout)}
        </div>
      </>
    );
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>{email}로 로그인됨</span>
        <button type="button" onClick={handleLogout} className="hover:text-primary">
          로그아웃
        </button>
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-3 text-sm">
        <span className="font-medium text-ink">네이버 블로그 아이디</span>
        {editingBlogId ? (
          <div className="flex gap-2">
            <input
              value={blogIdDraft}
              onChange={(e) => setBlogIdDraft(e.target.value)}
              placeholder="blog.naver.com/여기"
              className="flex-1 rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveBlogId}
              disabled={savingBlogId}
              className="rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-bg disabled:opacity-50"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditingBlogId(false)}
              className="rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-bg"
            >
              취소
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-ink-muted">{naverBlogId || "설정 안 됨"}</span>
            <button
              type="button"
              onClick={() => {
                setBlogIdDraft(naverBlogId);
                setEditingBlogId(true);
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {naverBlogId ? "수정" : "설정"}
            </button>
          </div>
        )}
      </div>

      {hasUsedToday ? (
        <div className="rounded-lg border-2 border-dashed border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-ink-muted">오늘은 이미 사용하셨어요. 내일 다시 시도해 주세요.</p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-lg border-2 border-hairline bg-surface p-4 shadow-sm transition-colors focus-within:border-primary sm:p-5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-ink">글 유형</span>
              <div className="flex flex-wrap gap-1.5">
                {BLOG_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setGroup(g.id);
                      setCategory(null);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                      group === g.id
                        ? "border-primary bg-primary text-white"
                        : "border-hairline text-ink-muted hover:bg-bg"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {group && (
                <select
                  value={category ?? ""}
                  onChange={(e) => setCategory(e.target.value as BlogCategory)}
                  disabled={loading}
                  className="rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none disabled:opacity-50"
                >
                  <option value="" disabled>
                    세부 유형을 골라주세요
                  </option>
                  {BLOG_CATEGORIES.filter((c) => c.group === group).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
              {selectedMeta && (
                <div className="rounded-md bg-bg px-3 py-2 text-xs text-ink-muted">
                  <p>{selectedMeta.description}</p>
                  <p className="mt-1">
                    사진 {selectedMeta.imageHint}
                    {selectedMeta.videoHint !== "-" && ` · 영상 ${selectedMeta.videoHint}`} · 특징:{" "}
                    {selectedMeta.markupHint}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-dashed border-hairline bg-bg p-3 text-xs">
              <span className="font-semibold text-ink-muted">예시 미리보기</span>
              {selectedMeta && selectedTheme ? (
                <div className="rounded-md border border-hairline bg-surface p-3">
                  <p className="text-sm font-bold text-ink" style={{ fontFamily: selectedTheme.headingFont }}>
                    {selectedMeta.sampleTitle}
                  </p>
                  <div className="mt-2 flex flex-col gap-1">
                    {renderPreviewBlocks(sampleBlocks, sampleResolveImage, selectedTheme)}
                  </div>
                </div>
              ) : (
                <p className="text-ink-muted">글 유형을 선택하면 실제 이런 느낌으로 쓰이는지 미리 보여드려요.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-ink">테마 색상·폰트 (선택 사항 — 비워두면 유형별 기본값 사용)</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setCustomAccent(p.value)}
                  disabled={loading}
                  aria-label={p.label}
                  title={p.label}
                  className={`h-6 w-6 rounded-full border-2 transition ${
                    customAccent === p.value ? "border-ink" : "border-transparent"
                  }`}
                  style={{ background: p.value }}
                />
              ))}
              <input
                type="color"
                value={customAccent ?? "#e06b3d"}
                onChange={(e) => setCustomAccent(e.target.value)}
                disabled={loading}
                title="직접 선택"
                className="h-6 w-6 cursor-pointer rounded border border-hairline bg-transparent p-0"
              />
              {customAccent && (
                <button
                  type="button"
                  onClick={() => setCustomAccent(null)}
                  disabled={loading}
                  className="text-xs font-semibold text-ink-muted hover:text-primary"
                >
                  기본값으로
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setCustomFont((cur) => (cur === f.value ? null : f.value))}
                  disabled={loading}
                  style={{ fontFamily: f.stack }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    customFont === f.value
                      ? "border-primary bg-primary text-white"
                      : "border-hairline text-ink-muted hover:bg-bg"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-muted">
              둥근 고딕·손글씨풍·굵은 임팩트는 그 폰트가 설치된 기기에서만 그 모양대로 보이고, 없으면 기본
              서체로 자연스럽게 대체돼요.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sponsored}
              disabled={loading}
              onChange={(e) => setSponsored(e.target.checked)}
              className="h-4 w-4 rounded border-hairline"
            />
            <span className="text-ink">협찬(광고비·물품을 받고 쓰는 글)이에요</span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">사진 (선택, 최대 {MAX_IMAGES}장)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileSelect}
              disabled={loading}
              className="text-sm text-ink-muted file:mr-3 file:rounded-md file:border file:border-hairline file:bg-bg file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
            <span className="text-xs text-ink-muted">
              사진이 없어도 프롬프트만으로 글을 완성해드려요 — 필요하면 스톡·AI 이미지를 추천해드립니다.
            </span>
          </label>

          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={`업로드한 사진 ${i + 1}`}
                  className="h-16 w-16 rounded-md border border-hairline object-cover"
                />
              ))}
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">어떤 글을 원하시나요?</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예: 이 카페 신메뉴 소개하는 글 써줘, 친근한 톤으로"
              rows={4}
              maxLength={500}
              className="rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              disabled={loading}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">
              타겟 키워드 <span className="font-normal text-ink-muted">(선택 — 상위 노출 글 형태를 참고해요)</span>
            </span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: 강남 카페 추천"
              maxLength={50}
              className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              disabled={loading}
            />
            <span className="text-xs text-ink-muted">
              이 키워드로 네이버에서 상위 노출되는 글들의 분량·구조(실제 문장은 절대 아님)를 참고해서 써드려요.
            </span>
          </label>

          {error && <p className="text-sm text-error">{error}</p>}

          {progress && (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-spring"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-xs text-ink-muted">{progress.label}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !prompt.trim() || !category}
            className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? "글 쓰는 중..." : "글 생성하기"}
          </button>
        </form>
      )}

      {result && resultResolveImage && resultTheme && (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          {imagesLoading && (
            <div className="flex items-center gap-2 rounded-md bg-bg px-3 py-2 text-xs text-ink-muted">
              <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              스톡·AI 이미지를 준비하고 있어요 — 글은 먼저 확인하실 수 있어요.
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">생성된 글{!finalized && " (조정 중)"}</h2>
            {finalized ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyPlain}
                  className="shrink-0 rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-bg"
                >
                  {plainCopied ? "복사됐어요" : "텍스트만 복사"}
                </button>
                <button
                  type="button"
                  onClick={handleCopyRich}
                  className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover"
                >
                  {richCopied ? "복사됐어요" : "서식 포함 복사"}
                </button>
                <button
                  type="button"
                  onClick={handleSendToExtension}
                  className="shrink-0 rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-bg"
                >
                  {extensionStatus === "sent" ? "확장으로 보냈어요" : "확장으로 보내기"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="shrink-0 rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-bg"
              >
                미리보기
              </button>
            )}
          </div>

          {finalized && extensionStatus === "not-found" && (
            <p className="text-xs text-error">
              확장 프로그램이 설치되어 있지 않은 것 같아요 — 설치 후 이 페이지를 새로고침해 주세요.
            </p>
          )}
          {finalized && !naverBlogId && (
            <p className="text-xs text-ink-muted">
              네이버 블로그 아이디를 위에서 설정해두면 &ldquo;확장으로 보내기&rdquo; 클릭 한 번으로 에디터 탭까지
              자동으로 열리고 붙여넣기까지 시도해요.
            </p>
          )}
          {finalized && (
            <p className="text-xs text-ink-muted">
              사진은 붙여넣기로 옮겨지지 않아요(네이버 에디터 제약) — 아래 미리보기의 &ldquo;이 사진 다운로드&rdquo;로
              저장한 뒤 붙여넣은 자리에 직접 끼워 넣어주세요.
            </p>
          )}

          {renderArticle()}

          {result.recommendedThumbnail > 0 && previews[result.recommendedThumbnail - 1] && (
            <div className="flex items-center gap-2 border-t border-hairline pt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[result.recommendedThumbnail - 1]}
                alt="추천 썸네일"
                className="h-12 w-12 rounded-md border border-hairline object-cover"
              />
              <p className="text-xs text-ink-muted">
                추천 썸네일: 사진 {result.recommendedThumbnail}
                {result.thumbnailReason && ` — ${result.thumbnailReason}`}
              </p>
            </div>
          )}

          {result.tags.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-hairline pt-3">
              <span className="text-xs font-semibold text-ink-muted">
                추천 태그 · 유형:{" "}
                {resultMeta ? `${BLOG_GROUPS.find((g) => g.id === resultMeta.group)?.label} · ${resultMeta.label}` : ""}{" "}
                — 하나씩 클릭해서 복사한 뒤 태그 입력창에 붙여넣고 Enter를 눌러주세요 (네이버 태그창은 한 번에
                여러 개를 못 받아요)
              </span>
              <div className="flex flex-wrap gap-1">
                {result.tags.map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleCopySingleTag(t, i)}
                    className="rounded-full bg-bg px-2 py-0.5 text-xs text-ink transition hover:bg-primary hover:text-white"
                  >
                    {copiedTagIndex === i ? "복사됨" : `#${t}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!finalized && (
            <div className="flex flex-col gap-4 border-t border-hairline pt-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-muted">스타일 프리셋 (선택 사항)</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStylePreset(null)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      stylePreset === null
                        ? "border-primary bg-primary text-white"
                        : "border-hairline text-ink-muted hover:bg-bg"
                    }`}
                  >
                    기본형
                  </button>
                  {STYLE_PRESET_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStylePreset(s.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        stylePreset === s.value
                          ? "border-primary bg-primary text-white"
                          : "border-hairline text-ink-muted hover:bg-bg"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-muted">레이아웃</span>
                <div className="flex flex-wrap gap-1.5">
                  {LAYOUT_PRESET_OPTIONS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLayout(l)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        layout === l ? "border-primary bg-primary text-white" : "border-hairline text-ink-muted hover:bg-bg"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {previews.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-ink-muted">
                    사진 순서 (본문에 이미 배정된 자리에 이 순서대로 채워져요)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {previews.map((src, i) => (
                      <div key={src} className="flex flex-col items-center gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`사진 ${i + 1}`}
                          className="h-14 w-14 rounded-md border border-hairline object-cover"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => movePhoto(i, -1)}
                            disabled={i === 0}
                            className="rounded-sm border border-hairline px-1.5 text-xs text-ink-muted transition hover:bg-bg disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => movePhoto(i, 1)}
                            disabled={i === previews.length - 1}
                            className="rounded-sm border border-hairline px-1.5 text-xs text-ink-muted transition hover:bg-bg disabled:opacity-30"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <KeywordSeoGauge entries={seoData} loading={seoLoading} />

              <LowQualityRiskCard assessment={result.lowQualityRisk} />

              {result.formatProfile && result.formatProfile.sampleSize > 0 && (
                <p className="text-xs text-ink-muted">
                  &quot;{result.formatProfile.keyword}&quot; 상위 노출 글 {result.formatProfile.sampleSize}개의
                  평균 형태(글자수·이미지·인용구·링크 수)를 참고해서 분량과 구성을 맞췄어요 — 실제 문장은
                  그대로 가져오지 않아요.
                </p>
              )}

              {result.stockImages.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-ink-muted">
                    추천 스톡 이미지 (Pixabay 제공) · 클릭하면 위 본문의 스톡이미지 자리에 순서대로 들어가요
                    (다시 클릭하면 빼요)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {result.stockImages.map((img) => {
                      const inserted = insertedStockImages.some((p) => p.webformatURL === img.webformatURL);
                      return (
                        <button
                          key={img.webformatURL}
                          type="button"
                          onClick={() => handleToggleStockImage(img)}
                          className={`relative h-16 w-16 overflow-hidden rounded-md border-2 transition ${
                            inserted ? "border-primary" : "border-hairline"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.webformatURL} alt={img.query} className="h-full w-full object-cover" />
                          {inserted && (
                            <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-ink-muted">
                  수정 요청 ({revisionCount}{isAdmin ? "회 사용" : `/${MAX_REVISIONS}회 사용`}) — 이 글에서 바꾸고 싶은 부분만 말씀해 주세요
                </span>
                <div className="flex gap-2">
                  <input
                    value={revisionInstruction}
                    onChange={(e) => setRevisionInstruction(e.target.value)}
                    placeholder="예: 제목을 더 짧게 해줘, 3번째 문단은 빼줘, 더 발랄한 톤으로"
                    maxLength={MAX_INSTRUCTION_LENGTH}
                    disabled={revising || (!isAdmin && revisionCount >= MAX_REVISIONS)}
                    className="flex-1 rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleRevise}
                    disabled={revising || !revisionInstruction.trim() || (!isAdmin && revisionCount >= MAX_REVISIONS)}
                    className="shrink-0 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                  >
                    {revising ? "수정 중..." : "수정하기"}
                  </button>
                </div>
                {!isAdmin && revisionCount >= MAX_REVISIONS && (
                  <p className="text-xs text-ink-muted">이 글은 수정 요청을 다 사용했어요. 다시 생성하면 초기화돼요.</p>
                )}
                {revisionError && <p className="text-sm text-error">{revisionError}</p>}
              </div>

              <button
                type="button"
                onClick={handleFinalize}
                className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
              >
                이 버전으로 확정하기
              </button>
            </div>
          )}

          {finalized && (
            <>
              {naverBlogId && (
                <a
                  href={`https://blog.naver.com/${naverBlogId}?Redirect=Write&`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
                >
                  네이버 블로그 글쓰기 열기
                </a>
              )}
              <button
                type="button"
                onClick={() => setFinalized(false)}
                className="text-xs font-semibold text-ink-muted hover:text-primary"
              >
                다시 조정하기
              </button>
            </>
          )}
        </div>
      )}

      {previewOpen && result && <PreviewModal onClose={() => setPreviewOpen(false)}>{renderArticle()}</PreviewModal>}
    </div>
  );
}
