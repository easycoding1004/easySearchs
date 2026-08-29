import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  getKeywordSnapshotHistory,
  getKeywordDirectory,
  type KeywordSnapshotPoint,
} from "@/lib/notion/keywordSnapshots";

export const dynamic = "force-dynamic";

const MAX_KEYWORD_LENGTH = 50;
const SIMILAR_KEYWORDS_SHOWN = 10;
// 변화율은 최소 이만큼 기간이 벌어진 스냅샷 쌍에서만 계산 — 하루 이틀 차이의
// 우연한 변동을 "변화"로 보여주지 않음(getRisingKeywords의 minDays와 같은 취지).
const MIN_CHANGE_SPAN_DAYS = 7;

// 2026-08 재설계(유입 전략) — 키워드 하나당 SEO 랜딩 페이지 하나. "○○ 검색량"
// 류의 롱테일 검색 유입을 노리는 프로그래매틱 SEO로, 이 분야 경쟁 서비스들의
// 검증된 플레이북. 데이터는 전부 스냅샷 DB에서만 서빙(네이버 API 무호출,
// 6시간 TTL 캐시)하고, 스냅샷이 없는 키워드는 404 — 빈 값으로 thin page를
// 만들지 않음(§ 정직한 빈 상태 원칙).

async function resolveKeyword(raw: string): Promise<string | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const keyword = decoded.trim();
  if (!keyword || keyword.length > MAX_KEYWORD_LENGTH) return null;
  return keyword;
}

function formatCount(count: number): string {
  return count > 0 ? `${count.toLocaleString("ko-KR")}회` : "10회 미만";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ keyword: string }>;
}): Promise<Metadata> {
  const { keyword: raw } = await params;
  const keyword = await resolveKeyword(raw);
  if (!keyword) return { title: "키워드 사전" };

  const history = await getKeywordSnapshotHistory(keyword).catch(() => []);
  const latest = history[history.length - 1];
  if (!latest) return { title: "키워드 사전" };

  return {
    title: `${keyword} 검색량`,
    description: `"${keyword}"의 네이버 월간 검색량은 PC ${formatCount(latest.pcCount)}, 모바일 ${formatCount(
      latest.mobileCount
    )}, 합계 ${formatCount(latest.totalCount)}입니다 (${latest.collectedAt} 수집 기준). 검색량 추이와 비슷한 키워드를 확인해보세요.`,
  };
}

// 서버에서 그대로 그리는 추이 폴리라인 — recharts(클라이언트) 없이 JS 0으로
// 렌더링돼 SEO 랜딩 특성(가볍고 크롤러 친화적)에 맞음.
function TrendSparkline({ points }: { points: KeywordSnapshotPoint[] }) {
  const w = 560;
  const h = 140;
  const pad = 10;
  const values = points.map((p) => p.totalCount);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = (w - pad * 2) / Math.max(values.length - 1, 1);
  const coords = values.map((v, i) => ({
    x: pad + i * step,
    y: h - pad - ((v - min) / range) * (h - pad * 2),
  }));
  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="검색량 추이 그래프">
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={4} fill="var(--color-primary)" />
    </svg>
  );
}

export default async function KeywordDetailPage({
  params,
}: {
  params: Promise<{ keyword: string }>;
}) {
  const { keyword: raw } = await params;
  const keyword = await resolveKeyword(raw);
  if (!keyword) notFound();

  const [history, directory] = await Promise.all([
    getKeywordSnapshotHistory(keyword).catch(() => []),
    getKeywordDirectory().catch(() => []),
  ]);
  const latest = history[history.length - 1];
  if (!latest) notFound();

  const earliest = history[0];
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const spanDays =
    (new Date(latest.collectedAt).getTime() - new Date(earliest.collectedAt).getTime()) /
    MS_PER_DAY;
  const changeRatio =
    history.length >= 2 && spanDays >= MIN_CHANGE_SPAN_DAYS && earliest.totalCount > 0
      ? (latest.totalCount - earliest.totalCount) / earliest.totalCount
      : null;

  const similar = directory
    .filter(
      (entry) =>
        entry.keyword !== keyword &&
        (entry.keyword.includes(keyword) || keyword.includes(entry.keyword))
    )
    .slice(0, SIMILAR_KEYWORDS_SHOWN);

  const stats = [
    { label: "PC 월간 검색수", value: formatCount(latest.pcCount) },
    { label: "모바일 월간 검색수", value: formatCount(latest.mobileCount) },
    { label: "합계", value: formatCount(latest.totalCount) },
  ];

  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-3">
          <Link href="/keyword" className="text-xs font-medium text-ink-muted hover:text-primary">
            ← 키워드 사전
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            <span className="text-primary">{keyword}</span> 검색량
          </h1>
          <p className="text-sm text-ink-muted">
            네이버 검색광고 API 기준 월간 검색수 · {latest.collectedAt} 수집
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-5">
              <span className="text-xs font-medium text-ink-muted">{stat.label}</span>
              <span className="text-2xl font-extrabold tracking-tight text-ink">{stat.value}</span>
            </div>
          ))}
        </div>

        {changeRatio !== null && (
          <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface p-4 text-sm">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                changeRatio > 0
                  ? "bg-success/10 text-success"
                  : changeRatio < 0
                    ? "bg-error/10 text-error"
                    : "bg-hairline text-ink-muted"
              }`}
            >
              {changeRatio > 0 ? "▲" : changeRatio < 0 ? "▼" : "－"}{" "}
              {Math.abs(Math.round(changeRatio * 100))}%
            </span>
            <span className="text-ink-muted">
              {earliest.collectedAt} 대비 검색량이{" "}
              {changeRatio > 0 ? "늘었어요" : changeRatio < 0 ? "줄었어요" : "비슷해요"}
            </span>
          </div>
        )}

        {history.length >= 3 && (
          <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5">
            <h2 className="text-base font-semibold text-ink">검색량 추이</h2>
            <TrendSparkline points={history} />
            <p className="text-xs text-ink-muted">
              {earliest.collectedAt} ~ {latest.collectedAt} · 수집 시점 {history.length}개 기준
            </p>
          </div>
        )}

        {similar.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-ink">비슷한 키워드</h2>
            <div className="flex flex-wrap gap-2">
              {similar.map((entry) => (
                <Link
                  key={entry.keyword}
                  href={`/keyword/${encodeURIComponent(entry.keyword)}`}
                  className="flex items-baseline gap-1.5 rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-sm transition hover:border-primary"
                >
                  <span className="font-medium text-ink">{entry.keyword}</span>
                  <span className="text-xs text-ink-muted">
                    {entry.latestCount > 0 ? entry.latestCount.toLocaleString("ko-KR") : "10 미만"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-lg border-2 border-primary/30 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">지금 이 키워드의 최신 데이터가 필요하세요?</p>
            <p className="text-xs text-ink-muted">
              연관 키워드·경쟁정도·블로그 발행량까지 실시간으로 조회할 수 있어요.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href={`/search?q=${encodeURIComponent(keyword)}`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
            >
              검색량 조회
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-hairline px-4 py-2 text-sm font-semibold text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97]"
            >
              블로그 진단
            </Link>
          </div>
        </div>

        <p className="text-xs text-ink-muted">
          이 페이지의 수치는 이지서치가 각 수집 시점에 저장한 네이버 검색광고 API 월간 검색수예요.
          실시간 값과 다를 수 있고, 검색량 10 미만은 네이버가 정확한 수치를 제공하지 않아요.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
