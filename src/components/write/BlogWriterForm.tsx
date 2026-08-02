"use client";

import { useState } from "react";
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
  CIRCLED_DIGITS,
  type BodyBlock,
  type BodyInline,
  type SlotBlock,
  type GalleryBlock,
} from "@/lib/write/parseBody";

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
}

// 텍스트/강조 인라인만 렌더링 — v2부터 이미지는 더 이상 인라인 토큰이 아니라
// 블록 단위(SLOT/GALLERY)라 여기서는 이미지 처리를 하지 않는다.
function renderInlineNodes(pieces: BodyInline[], keyPrefix: string) {
  return pieces.map((piece, j) => {
    const key = `${keyPrefix}-${j}`;
    if (piece.type === "em") {
      return (
        <strong key={key} className="rounded bg-primary/15 px-1 font-bold text-primary">
          {piece.text}
        </strong>
      );
    }
    return <span key={key}>{piece.text}</span>;
  });
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
  key: string
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
        <div className={block.type === "gallery" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex flex-col gap-2"}>
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

function renderTableBlock(block: Extract<BodyBlock, { type: "table" }>, key: string) {
  return (
    <div key={key} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {block.headers.map((h, i) => (
              <th key={i} className="border border-hairline bg-bg px-2 py-1 text-left font-semibold text-ink">
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

function renderPreviewBlocks(blocks: BodyBlock[], resolveImage: ReturnType<typeof createImageResolver>) {
  return blocks.map((block, i) => {
    const key = `${i}`;
    switch (block.type) {
      case "heading":
        return (
          <h3 key={key} className="mt-2 border-b-2 border-primary/25 pb-1 text-base font-extrabold text-primary">
            ◆ {block.text}
          </h3>
        );
      case "list":
        return (
          <div key={key} className="flex flex-col gap-1">
            {block.items.map((item, idx) => (
              <p key={idx} className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                <span className="mr-1.5 font-bold text-primary">
                  {block.ordered ? (CIRCLED_DIGITS[idx] ?? `${idx + 1}.`) : "▶"}
                </span>
                {renderInlineNodes(item, `${key}-${idx}`)}
              </p>
            ))}
          </div>
        );
      case "paragraph":
        return (
          <p key={key} className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {renderInlineNodes(block.inline, key)}
          </p>
        );
      case "divider":
        return <hr key={key} className="my-2 border-t-2 border-primary/20" />;
      case "quote":
        return (
          <blockquote key={key} className="border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm italic text-ink">
            {block.text}
          </blockquote>
        );
      case "table":
        return renderTableBlock(block, key);
      case "place":
        return (
          <p key={key} className="text-sm text-ink">
            📍 <strong>{block.name}</strong>
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
              className="font-semibold text-primary hover:underline"
            >
              {block.description || block.url}
            </a>
          </p>
        );
      case "slot":
      case "gallery":
        return renderMediaBlock(block, resolveImage, key);
      default:
        return null;
    }
  });
}

export default function BlogWriterForm({
  email,
  hasUsedToday,
  naverBlogId: initialNaverBlogId,
}: {
  email: string;
  hasUsedToday: boolean;
  naverBlogId: string;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [group, setGroup] = useState<BlogGroup | null>(null);
  const [category, setCategory] = useState<BlogCategory | null>(null);
  const [sponsored, setSponsored] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const [naverBlogId, setNaverBlogId] = useState(initialNaverBlogId);
  const [editingBlogId, setEditingBlogId] = useState(false);
  const [blogIdDraft, setBlogIdDraft] = useState(initialNaverBlogId);
  const [savingBlogId, setSavingBlogId] = useState(false);

  const previews = files.map((f) => URL.createObjectURL(f));
  const selectedMeta = category ? getBlogCategoryMeta(category) : null;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES);
    setFiles(selected);
    setResult(null);
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

    try {
      const formData = new FormData();
      formData.set("prompt", prompt.trim());
      formData.set("category", category);
      formData.set("sponsored", String(sponsored));
      for (const file of files) formData.append("images", file);

      const res = await fetch("/api/write", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "글 생성에 실패했어요.");
        return;
      }

      setResult(data);
      router.refresh(); // hasUsedToday를 서버에서 다시 계산해 오늘 1회 소진 반영
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  // 이미 생성된 글에 "제목을 더 짧게", "3번째 문단 빼줘" 같은 수정을 반영—
  // /api/write와 별도 라우트라 하루 1회 제한과 무관하게 쓸 수 있지만, 대신
  // 이 글 하나당 MAX_REVISIONS번까지만 되도록 서버가 다시 검증함.
  async function handleRevise() {
    if (!result || !revisionInstruction.trim() || revising || revisionCount >= MAX_REVISIONS) return;

    setRevising(true);
    setRevisionError(null);

    try {
      const formData = new FormData();
      formData.set("instruction", revisionInstruction.trim());
      formData.set("category", result.category);
      formData.set("sponsored", String(result.sponsored));
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

  async function handleCopyPlain() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`${result.title}\n\n${stripBodyMarkup(result.body)}`);
      setPlainCopied(true);
      setTimeout(() => setPlainCopied(false), 2000);
    } catch {
      // Clipboard access blocked — no feedback to show.
    }
  }

  // 네이버 에디터에 붙여넣을 때 굵게/소제목/목록 서식이 살아 있도록 text/html도
  // 같이 써넣는다(실측 확인: 이 서식 자체는 붙여넣기에서 유지됨). 이미지는
  // <img>를 넣어도 붙여넣기에서 통째로 사라지는 게 실측 확인돼서(글자만
  // 들어감), renderBodyToHtml이 아예 embed하지 않고 안내 문구만 남김 — 실제
  // 사진은 미리보기의 "이 사진 다운로드"로 받아서 직접 끼워 넣어야 함.
  async function handleCopyRich() {
    if (!result) return;
    try {
      const blocks = parseBody(result.body);
      const html = `<h2 style="font-size:22px;font-weight:700;margin:0 0 14px;">${escapeHtmlText(result.title)}</h2>\n${renderBodyToHtml(blocks)}`;
      const plain = `${result.title}\n\n${stripBodyMarkup(result.body)}`;

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

  // 크롬 확장(2026-08 추가)으로 초안을 넘겨서, 네이버 블로그 에디터 탭에서
  // 자동 붙여넣기 버튼이 뜨게 함 — window.postMessage로만 통신하고 확장
  // ID를 이 코드가 알 필요는 없음(확장이 설치돼 있으면 write 페이지에 심어둔
  // content script가 이 메시지를 받아 자기 background로 중계함). 확장이 없으면
  // 아무도 안 받으니, 짧은 시간 안에 ACK가 안 오면 "설치 안 된 것 같다"고
  // 안내함.
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
    const blocks = parseBody(result.body);
    const bodyHtml = renderBodyToHtmlForExtension(blocks);
    const html = `<h2 style="font-size:22px;font-weight:700;margin:0 0 14px;">${escapeHtmlText(result.title)}</h2>\n${bodyHtml}`;

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
      clearTimeout(timeoutId);
      setExtensionStatus("sent");
      setTimeout(() => setExtensionStatus("idle"), 3000);
    }
    window.addEventListener("message", onAck);
    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", onAck);
      setExtensionStatus("not-found");
      setTimeout(() => setExtensionStatus("idle"), 4000);
    }, 800);

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
  const resultResolveImage = result
    ? createImageResolver({ photoSrcs: previews, stockImages: insertedStockImages, aiImages: result.aiImages })
    : null;

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

            <div className="flex flex-col gap-1 rounded-md border border-dashed border-hairline bg-bg p-3 text-xs">
              <span className="font-semibold text-ink-muted">예시 미리보기</span>
              {selectedMeta ? (
                <p className="whitespace-pre-wrap leading-relaxed text-ink">{selectedMeta.sample}</p>
              ) : (
                <p className="text-ink-muted">글 유형을 선택하면 어떤 식으로 쓰이는지 예시를 보여드려요.</p>
              )}
            </div>
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

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={loading || !prompt.trim() || !category}
            className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? "글 쓰는 중... (최대 1분 정도 걸려요)" : "글 생성하기"}
          </button>
        </form>
      )}

      {result && resultResolveImage && (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">생성된 글</h2>
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
          </div>
          {extensionStatus === "not-found" && (
            <p className="text-xs text-error">
              확장 프로그램이 설치되어 있지 않은 것 같아요 — 설치 후 이 페이지를 새로고침해 주세요.
            </p>
          )}
          <p className="text-xs text-ink-muted">
            사진은 붙여넣기로 옮겨지지 않아요(네이버 에디터 제약) — 아래 미리보기의 &ldquo;이 사진 다운로드&rdquo;로
            저장한 뒤 붙여넣은 자리에 직접 끼워 넣어주세요.
          </p>
          <p className="text-lg font-bold text-ink">
            {result.title}
            {result.sponsored && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-semibold text-amber-800">
                협찬
              </span>
            )}
          </p>
          <div className="flex flex-col gap-1">{renderPreviewBlocks(resultBlocks, resultResolveImage)}</div>

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

          {result.stockImages.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-hairline pt-3">
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

          <div className="flex flex-col gap-2 border-t border-hairline pt-3">
            <span className="text-xs font-semibold text-ink-muted">
              수정 요청 ({revisionCount}/{MAX_REVISIONS}회 사용) — 이 글에서 바꾸고 싶은 부분만 말씀해 주세요
            </span>
            <div className="flex gap-2">
              <input
                value={revisionInstruction}
                onChange={(e) => setRevisionInstruction(e.target.value)}
                placeholder="예: 제목을 더 짧게 해줘, 3번째 문단은 빼줘, 더 발랄한 톤으로"
                maxLength={MAX_INSTRUCTION_LENGTH}
                disabled={revising || revisionCount >= MAX_REVISIONS}
                className="flex-1 rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleRevise}
                disabled={revising || !revisionInstruction.trim() || revisionCount >= MAX_REVISIONS}
                className="shrink-0 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
              >
                {revising ? "수정 중..." : "수정하기"}
              </button>
            </div>
            {revisionCount >= MAX_REVISIONS && (
              <p className="text-xs text-ink-muted">이 글은 수정 요청을 다 사용했어요. 다시 생성하면 초기화돼요.</p>
            )}
            {revisionError && <p className="text-sm text-error">{revisionError}</p>}
          </div>

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
        </div>
      )}
    </div>
  );
}
