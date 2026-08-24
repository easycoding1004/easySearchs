import Link from "next/link";
import { RADAR_AXES, compositeScore, type GapMessage, type RadarScore } from "@/lib/dashboard/contentDiagnostics";
import type { BlogProfileStats } from "@/lib/naver/blogProfileScraper";
import { formatKstDateTime } from "@/lib/utils/formatDate";

type AxisKey = (typeof RADAR_AXES)[number]["key"];

const HEART_PATH =
  "M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z";
const SHARE_PATH =
  "M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14";

const AXIS_ICONS: Record<AxisKey, React.ReactNode> = {
  postCount: <path d="M6 3h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v6h6M8 13h8M8 17h5" />,
  engagement: (
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  ),
  reactionScore: <path d={HEART_PATH} />,
  shareScore: <path d={SHARE_PATH} />,
};

type ProfileField =
  | "category"
  | "todayVisitor"
  | "totalVisitor"
  | "subscriber"
  | "postCount"
  | "recentComments"
  | "recentReactions"
  | "recentShares";

const PROFILE_ICONS: Record<ProfileField, React.ReactNode> = {
  category: (
    <>
      <path d="M20 12l-8 8-9-9V4h7l10 8z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  todayVisitor: <path d="M3 17l4-6 4 3 4-7 6 10M3 20h18" />,
  totalVisitor: (
    <>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  subscriber: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6M16 4.5a3 3 0 010 5.8M22 20c0-2.8-2.3-5.1-5.3-5.8" />
    </>
  ),
  postCount: <path d="M6 3h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v6h6M8 13h8M8 17h5" />,
  recentComments: (
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  ),
  recentReactions: <path d={HEART_PATH} />,
  recentShares: <path d={SHARE_PATH} />,
};

interface Band {
  max: number;
  label: string;
  color: string;
}

const BANDS: Band[] = [
  { max: 39, label: "일반", color: "var(--chart-series-mobile)" },
  { max: 69, label: "준최적화", color: "var(--chart-series-quaternary)" },
  { max: 100, label: "최적화", color: "var(--chart-series-tertiary)" },
];

function bandFor(score: number): Band {
  return BANDS.find((b) => score <= b.max) ?? BANDS[BANDS.length - 1];
}

// 0-100 내부 점수를 10점 만점 소수 한 자리로 변환 (예: 49 → "4.9") —
// 흔히 보는 블로그 지수 도구들의 10점 게이지 표기를 참고한 표시 방식일 뿐,
// 내부 산정 로직(RADAR_AXES 콘텐츠 진단 지표 평균)은 그대로다.
function toTenScale(score: number): string {
  return (score / 10).toFixed(1);
}

const GAUGE_TICKS = [1, 3, 5, 7, 9];

function ScoreGauge({ score }: { score: number }) {
  const band = bandFor(score);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex text-xs font-medium text-ink-muted">
        {BANDS.map((b, i) => {
          const prevMax = i === 0 ? 0 : BANDS[i - 1].max;
          return (
            <span
              key={b.label}
              className="text-center first:text-left last:text-right"
              style={{ width: `${b.max - prevMax}%` }}
            >
              {b.label}
            </span>
          );
        })}
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full">
        <div className="flex h-full w-full">
          {BANDS.map((b, i) => {
            const prevMax = i === 0 ? 0 : BANDS[i - 1].max;
            return (
              <div
                key={b.label}
                className="h-full"
                style={{ width: `${b.max - prevMax}%`, background: b.color, opacity: 0.35 }}
              />
            );
          })}
        </div>
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-surface transition-all ease-spring"
          style={{ left: `${score}%`, background: band.color }}
        />
      </div>
      <div className="relative h-3 w-full text-[10px] text-ink-muted">
        {GAUGE_TICKS.map((tick) => (
          <span
            key={tick}
            className="absolute -translate-x-1/2"
            style={{ left: `${tick * 10}%` }}
          >
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProfileStatCard({
  field,
  value,
  label,
}: {
  field: ProfileField;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-md bg-bg p-2.5 text-center sm:p-3">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mx-auto mb-1 h-4 w-4 text-ink-muted"
      >
        {PROFILE_ICONS[field]}
      </svg>
      <div className="text-sm font-bold text-ink sm:text-base">{value}</div>
      <div className="text-[11px] text-ink-muted">{label}</div>
    </div>
  );
}

function formatCount(value: number | null): string {
  if (value == null) return "비공개";
  if (value >= 10000) return `${(value / 10000).toFixed(1)}만`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatDecimalCount(value: number | null): string {
  if (value == null) return "확인 불가";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function BlogScoreCard({
  score,
  profile,
  avgRecentComments,
  avgRecentReactions,
  avgRecentShares,
  terms,
  rank,
}: {
  score: RadarScore;
  profile: BlogProfileStats | null | undefined;
  avgRecentComments: number | null | undefined;
  avgRecentReactions: number | null | undefined;
  avgRecentShares: number | null | undefined;
  terms: { term: string; count: number }[] | undefined;
  rank: { position: number; total: number } | null;
}) {
  const composite = compositeScore(score);
  const band = bandFor(composite);

  return (
    <div className="panel-transition rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {score.isMine && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
            내 블로그
          </span>
        )}
        <span className="break-all text-sm font-semibold text-ink">{score.label}</span>
        {rank && (
          <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium text-ink-muted">
            비교 대상 중 {rank.position}/{rank.total}위
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <ScoreGauge score={composite} />
        </div>
        <div className="shrink-0 text-right">
          <div className="text-3xl font-extrabold leading-none" style={{ color: band.color }}>
            {toTenScale(composite)}
          </div>
          <div className="mt-1 text-xs font-medium" style={{ color: band.color }}>
            {band.label}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          블로그 프로필 (네이버 공식 API 아님 — 공개 페이지 기준)
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <ProfileStatCard field="category" value={profile?.category ?? "비공개"} label="카테고리" />
          <ProfileStatCard
            field="todayVisitor"
            value={formatCount(profile?.todayVisitorCount ?? null)}
            label="최근 방문자"
          />
          <ProfileStatCard
            field="totalVisitor"
            value={formatCount(profile?.totalVisitorCount ?? null)}
            label="총 방문자"
          />
          <ProfileStatCard
            field="subscriber"
            value={formatCount(profile?.subscriberCount ?? null)}
            label="이웃 수"
          />
          <ProfileStatCard
            field="postCount"
            value={formatCount(profile?.postCount ?? null)}
            label="총 포스팅"
          />
          <ProfileStatCard
            field="recentComments"
            value={formatDecimalCount(avgRecentComments ?? null)}
            label="최근 게시물 평균 댓글"
          />
          <ProfileStatCard
            field="recentReactions"
            value={formatDecimalCount(avgRecentReactions ?? null)}
            label="최근 게시물 평균 공감"
          />
          <ProfileStatCard
            field="recentShares"
            value={formatDecimalCount(avgRecentShares ?? null)}
            label="최근 게시물 평균 공유"
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          콘텐츠 진단 지표 (자체 산정)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {RADAR_AXES.map(({ key, label }) => (
            <div key={key} className="rounded-md bg-bg p-2.5 text-center sm:p-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto mb-1 h-4 w-4 text-ink-muted"
              >
                {AXIS_ICONS[key]}
              </svg>
              <div className="text-base font-bold text-ink sm:text-lg">{score[key]}</div>
              <div className="text-[11px] text-ink-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {terms && terms.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            자주 쓰는 단어 (게시물 제목 형태소 분석)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {terms.map((t) => (
              <span
                key={t.term}
                className="rounded-full bg-bg px-2.5 py-1 text-xs text-ink-muted"
              >
                {t.term} <span className="text-ink">{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BlogScorePanel({
  scores,
  gaps,
  fetchedAt,
  profileStats,
  avgRecentComments,
  avgRecentReactions,
  avgRecentShares,
  topTerms,
  insightReport,
  insightLocked = false,
}: {
  scores: RadarScore[];
  gaps: GapMessage[];
  fetchedAt: string;
  profileStats: Record<string, BlogProfileStats | null>;
  avgRecentComments: Record<string, number | null>;
  avgRecentReactions: Record<string, number | null>;
  avgRecentShares: Record<string, number | null>;
  topTerms: Record<string, { term: string; count: number }[]>;
  insightReport: string | null;
  // 2026-08 추가(토스페이먼츠 월 구독제) — 이 결과를 보고 있는 사람이
  // 유료회원이 아니면 true. insightReport가 실제로 있어도(다른 유료회원이
  // 생성한 세션일 수 있음) 이 화면의 조회자가 유료가 아니면 내용 대신
  // 구독 유도 카드를 보여줌 — 공유 URL로 무료 열람이 되지 않게 함.
  insightLocked?: boolean;
}) {
  const mine = scores.find((s) => s.isMine);
  const competitors = scores.filter((s) => !s.isMine);

  if (!mine && competitors.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-hairline bg-surface p-5 text-sm text-ink-muted">
        내 블로그 도메인과 비교 블로그가 입력되어 있지 않습니다. 블로그지수에서 다시 조회할 때 입력해 주세요.
      </section>
    );
  }

  const ranked = [...scores].sort((a, b) => compositeScore(b) - compositeScore(a));
  const showRank = scores.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">블로그 지수</h2>
          <p className="text-sm text-ink-muted">
            최근 게시물 활동량 기반 콘텐츠 진단 {RADAR_AXES.length}개 지표를 종합해 10점 만점으로 환산한 자체 점수예요 (네이버
            공식 지표나 다른 블로그 지수 서비스의 점수와는 산정 방식이 다릅니다). 순위도 이번에 함께 조회한
            블로그끼리 비교한 것으로, 네이버 전체 블로그 대비 순위가 아니에요.
          </p>
        </div>
        <span className="text-xs text-ink-muted">
          {formatKstDateTime(fetchedAt)} 기준
        </span>
      </div>

      {insightLocked ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-ink">AI 인사이트</h3>
          <p className="text-sm text-ink-muted">
            블로그 데이터를 AI가 요약해주는 인사이트는 유료회원 전용이에요. 구독하면 볼 수 있어요.
          </p>
          <Link href="/subscribe" className="text-sm font-semibold text-primary hover:underline">
            구독하러 가기 →
          </Link>
        </div>
      ) : (
        insightReport && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <h3 className="mb-2 text-sm font-semibold text-ink">AI 인사이트</h3>
            <p className="whitespace-pre-wrap text-sm text-ink">{insightReport}</p>
            <p className="mt-2 text-xs text-ink-muted">
              위 데이터를 바탕으로 AI가 요약한 참고용 의견이에요 — 네이버 공식 진단이 아니에요.
            </p>
          </div>
        )
      )}

      {!mine && (
        <p className="text-sm text-ink-muted">
          내 블로그 도메인이 입력되어 있지 않아 비교 블로그 점수만 보여드려요. 블로그지수에서 다시 조회할 때 내 블로그 주소를 입력하면 비교할 수 있어요.
        </p>
      )}
      {mine && competitors.length === 0 && (
        <p className="text-sm text-ink-muted">
          비교 블로그가 입력되어 있지 않아 내 블로그 점수만 보여드려요. 블로그지수에서 다시 조회할 때 비교 블로그 주소를 입력하면 비교할 수 있어요.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {mine && (
          <BlogScoreCard
            score={mine}
            profile={profileStats[mine.domain]}
            avgRecentComments={avgRecentComments[mine.domain]}
            avgRecentReactions={avgRecentReactions[mine.domain]}
            avgRecentShares={avgRecentShares[mine.domain]}
            terms={topTerms[mine.domain]}
            rank={
              showRank
                ? { position: ranked.findIndex((s) => s.domain === mine.domain) + 1, total: ranked.length }
                : null
            }
          />
        )}
        {competitors.map((c) => (
          <BlogScoreCard
            key={c.domain}
            score={c}
            profile={profileStats[c.domain]}
            avgRecentComments={avgRecentComments[c.domain]}
            avgRecentReactions={avgRecentReactions[c.domain]}
            avgRecentShares={avgRecentShares[c.domain]}
            terms={topTerms[c.domain]}
            rank={
              showRank
                ? { position: ranked.findIndex((s) => s.domain === c.domain) + 1, total: ranked.length }
                : null
            }
          />
        ))}
      </div>

      {gaps.length > 0 && (
        <div className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-semibold text-ink">무엇이 부족한가</h3>
          <ul className="flex flex-col gap-2">
            {gaps.map((gap) => (
              <li key={gap.axis} className="rounded-md border border-hairline bg-bg p-3 text-sm">
                <span className="font-medium text-ink">{gap.axis}</span>
                <p className="mt-0.5 text-ink-muted">{gap.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
