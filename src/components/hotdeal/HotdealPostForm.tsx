"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_TITLE_LENGTH = 120;
const MAX_MODEL_LENGTH = 80;
const MAX_NICKNAME_LENGTH = 20;
const MAX_COMPARISONS = 5;

interface ComparisonRow {
  platform: string;
  price: string;
  url: string;
}

// 핫딜정보 게시판 작성 폼(§CLAUDE.md 신규 섹션) — 11번가·쿠팡파트너스 API가
// 사업자 전용이라 시스템 자동 비교 대신, 회원이 직접 쇼핑몰별 가격·링크를
// 입력하는 반복 행 구조로 구현(뽐뿌·알구몬 같은 실제 핫딜 커뮤니티와 동일한
// 방식). board.ts의 BoardPostForm.tsx와 같은 로그인/닉네임 흐름.
export default function HotdealPostForm({ needsNickname }: { needsNickname: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [modelName, setModelName] = useState("");
  const [body, setBody] = useState("");
  const [rows, setRows] = useState<ComparisonRow[]>([{ platform: "", price: "", url: "" }]);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, field: keyof ComparisonRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    if (rows.length >= MAX_COMPARISONS) return;
    setRows((prev) => [...prev, { platform: "", price: "", url: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !modelName.trim() || loading) return;
    if (needsNickname && !nickname.trim()) {
      setError("게시판에서 쓸 닉네임을 입력해 주세요.");
      return;
    }

    const comparisons = rows
      .filter((r) => r.platform.trim() && r.url.trim() && r.price.trim())
      .map((r) => ({ platform: r.platform.trim(), price: Number(r.price), url: r.url.trim() }));
    if (comparisons.length === 0) {
      setError("가격 비교 정보를 최소 1개 이상 입력해 주세요.");
      return;
    }
    if (comparisons.some((c) => !Number.isFinite(c.price) || c.price <= 0)) {
      setError("가격은 0보다 큰 숫자로 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hotdeal/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          modelName: modelName.trim(),
          body: body.trim(),
          comparisons,
          nickname: needsNickname ? nickname.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "게시글 작성에 실패했어요.");
        return;
      }
      router.push(`/hotdeal/${data.id}`);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl flex-col gap-3 rounded-lg border-2 border-hairline bg-surface p-4 shadow-sm sm:p-5"
    >
      {needsNickname && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">닉네임 (처음 한 번만 설정, 이후 게시글에 계속 표시돼요)</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={MAX_NICKNAME_LENGTH}
            placeholder="게시판에서 쓸 이름"
            disabled={loading}
            className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="예: 갤럭시버즈3 프로 역대급 할인"
          disabled={loading}
          className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">모델명 (검색에 쓰여요)</span>
        <input
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          maxLength={MAX_MODEL_LENGTH}
          placeholder="예: 갤럭시버즈3 프로"
          disabled={loading}
          className="h-11 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-ink">가격 비교 (최대 {MAX_COMPARISONS}곳)</span>
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-md border border-hairline p-2.5 sm:flex-row sm:items-center sm:gap-2 sm:p-2"
          >
            <input
              value={row.platform}
              onChange={(e) => updateRow(i, "platform", e.target.value)}
              placeholder="쇼핑몰 (예: 쿠팡)"
              disabled={loading}
              className="h-10 rounded-sm border border-hairline bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none sm:w-28"
            />
            <input
              value={row.price}
              onChange={(e) => updateRow(i, "price", e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="가격(원)"
              inputMode="numeric"
              disabled={loading}
              className="h-10 rounded-sm border border-hairline bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none sm:w-28"
            />
            <input
              value={row.url}
              onChange={(e) => updateRow(i, "url", e.target.value)}
              placeholder="구매 링크 URL"
              disabled={loading}
              className="h-10 flex-1 rounded-sm border border-hairline bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={loading}
                className="shrink-0 rounded-md border border-hairline px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-bg"
              >
                삭제
              </button>
            )}
          </div>
        ))}
        {rows.length < MAX_COMPARISONS && (
          <button
            type="button"
            onClick={addRow}
            disabled={loading}
            className="w-fit rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-primary hover:bg-bg"
          >
            + 쇼핑몰 추가
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">추가 설명 (선택)</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="쿠폰 적용 방법, 배송 팁 등을 자유롭게 적어주세요."
          disabled={loading}
          className="rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={loading || !title.trim() || !modelName.trim()}
        className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97] disabled:opacity-50"
      >
        {loading ? "게시하는 중..." : "게시하기"}
      </button>
    </form>
  );
}
