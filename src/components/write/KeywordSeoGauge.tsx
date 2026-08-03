"use client";

// 2026-08 추가(사용자 요청 — "SEO 노출도 분석, 키워드 경쟁도를 게이지바로
// 절대값 기준으로") — 네이버 검색광고 API 실측 데이터(자체 계산 점수 아님,
// /api/write/keyword-seo가 조회)를 게이지로 보여준다. 시각 패턴은
// src/components/dashboard/BlogScorePanel.tsx의 밴드+마커 게이지를 참고했지만
// 그 파일을 직접 import하지 않고 새로 작성함 — dashboard 전용 컴포넌트를
// write가 가져다 쓰면 §CLAUDE.md 14의 기능별 폴더 컨벤션 위반.
export interface KeywordSeoEntry {
  keyword: string;
  monthlyVolume: number | null;
  compIdx: "낮음" | "중간" | "높음" | null;
}

// 검색량은 키워드마다 등락 폭이 커서(수십~수만) 로그 스케일로 게이지 위치를
// 계산한다 — 이 상한(MAX_VOLUME_FOR_GAUGE)은 실측 표본 없이 잡은 초기
// 추정치라, 다른 절대기준 지표들(§CLAUDE.md 10.3의 RADAR_AXES 임계값)처럼
// 실사용 데이터가 쌓이면 재조정이 필요할 수 있다.
const MAX_VOLUME_FOR_GAUGE = 20000;

function volumeToPercent(volume: number): number {
  if (volume <= 0) return 0;
  const percent = (Math.log10(volume + 1) / Math.log10(MAX_VOLUME_FOR_GAUGE + 1)) * 100;
  return Math.min(100, Math.max(3, Math.round(percent)));
}

const COMP_PERCENT: Record<"낮음" | "중간" | "높음", number> = { 낮음: 25, 중간: 60, 높음: 90 };

function MiniGauge({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
      <div
        className="h-full rounded-full transition-all duration-300 ease-spring"
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

export default function KeywordSeoGauge({
  entries,
  loading,
}: {
  entries: KeywordSeoEntry[] | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-xs text-ink-muted">키워드 검색량·경쟁도를 조회하고 있어요...</p>;
  }
  if (!entries || entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold text-ink-muted">키워드 검색량·경쟁도 (실측)</span>
      {entries.map((entry) => (
        <div key={entry.keyword} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink">#{entry.keyword}</span>
          {entry.monthlyVolume === null ? (
            <p className="text-xs text-ink-muted">데이터 없음</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-ink-muted">검색량</span>
                <MiniGauge percent={volumeToPercent(entry.monthlyVolume)} color="#2563eb" />
                <span className="w-20 shrink-0 text-right text-[11px] text-ink-muted">
                  월 {entry.monthlyVolume.toLocaleString("ko-KR")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-ink-muted">경쟁도</span>
                <MiniGauge percent={entry.compIdx ? COMP_PERCENT[entry.compIdx] : 0} color="#ea580c" />
                <span className="w-20 shrink-0 text-right text-[11px] text-ink-muted">{entry.compIdx ?? "-"}</span>
              </div>
            </>
          )}
        </div>
      ))}
      <p className="text-[11px] text-ink-muted">
        네이버 검색광고 API 실측 데이터예요 — 스타일·레이아웃을 바꿔도 이 값은 그대로고, 실제 검색결과 노출
        순위를 보장하지는 않아요.
      </p>
    </div>
  );
}
