import type { LowQualityAssessment, LowQualityLevel } from "@/lib/write/lowQualityRisk";

// 2026-08 추가 — BlogScorePanel.tsx의 밴드+마커 게이지 시각 패턴을 참고했지만
// 직접 import하지 않고 새로 작성함(§CLAUDE.md 14 — dashboard 전용 컴포넌트를
// write가 가져다 쓰면 폴더 컨벤션 위반, KeywordSeoGauge.tsx와 같은 이유).
const LEVEL_STYLE: Record<LowQualityLevel, { bar: string; text: string; badge: string }> = {
  낮음: { bar: "bg-success", text: "text-success", badge: "bg-success/10 text-success" },
  보통: { bar: "bg-accent", text: "text-accent", badge: "bg-accent/15 text-on-brand" },
  높음: { bar: "bg-error", text: "text-error", badge: "bg-error/10 text-error" },
};

// 점수가 클수록 위험 — 게이지는 0(안전)~15(위험 상한, 대략적 실사용 상한치)로
// 정규화. 15점을 넘겨도 100%로 캡.
const MAX_POINTS_FOR_BAR = 15;

export default function LowQualityRiskCard({ assessment }: { assessment: LowQualityAssessment }) {
  const style = LEVEL_STYLE[assessment.level];
  const barPercent = Math.min(100, Math.round((assessment.totalPoints / MAX_POINTS_FOR_BAR) * 100));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">저품질 위험도</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style.badge}`}>{assessment.level}</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
        <div className={`h-full rounded-full transition-all ${style.bar}`} style={{ width: `${barPercent}%` }} />
      </div>

      {assessment.flags.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {assessment.flags.map((flag) => (
            <li key={flag.id} className="flex items-start gap-2 text-xs text-ink-muted">
              <span className={`mt-0.5 shrink-0 font-bold ${style.text}`}>·</span>
              <span>{flag.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-muted">눈에 띄는 위험 신호가 안 보여요.</p>
      )}

      <p className="text-[11px] leading-relaxed text-ink-muted">
        네이버가 공식적으로 공개한 저품질 판정 기준이 아니라, SEO 커뮤니티·대행사 글들이 공통으로 지목하는
        위험 신호를 참고해 이 글의 텍스트만으로 추정한 자체 지표예요. 점수가 낮다고 저품질에서 완전히 안전한
        건 아니고, 높다고 반드시 저품질이 되는 것도 아니에요 — 참고용으로만 봐주세요.
      </p>
    </div>
  );
}
