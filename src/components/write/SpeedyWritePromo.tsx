// 2026-08 추가 — /write 페이지 상단 홍보 배너(사용자 요청): "블로그 쓰는 데
// 1~2시간 허비하지 말고 3분이면 끝내라"는 메시지를 마스코트 캐릭터와 함께
// 보여줌. 이 사이트에 아직 실제 일러스트 에셋이 없어서(로고 하나뿐,
// design-system.md §2) 브랜드 톤(코랄/앰버, 둥근 형태)에 맞춘 인라인 SVG로
// 새로 그렸다 — FeatureShowcase.tsx의 미니 일러스트와 같은 제작 방식.
function SpeedyMascot() {
  return (
    <svg viewBox="0 0 140 140" className="h-full w-full" aria-hidden>
      {/* 속도감을 나타내는 배경 줄무늬 */}
      <path d="M6 58 L34 58" stroke="currentColor" strokeWidth={4} strokeLinecap="round" className="text-accent/40" />
      <path d="M2 74 L30 74" stroke="currentColor" strokeWidth={4} strokeLinecap="round" className="text-accent/30" />
      <path d="M8 90 L32 90" stroke="currentColor" strokeWidth={4} strokeLinecap="round" className="text-accent/20" />

      {/* 몸통 */}
      <rect x="38" y="62" width="64" height="58" rx="24" className="fill-primary" />
      {/* 머리 */}
      <circle cx="70" cy="48" r="30" className="fill-accent" />
      {/* 안테나 */}
      <line x1="70" y1="18" x2="70" y2="6" stroke="currentColor" strokeWidth={3} strokeLinecap="round" className="text-primary" />
      <circle cx="70" cy="4" r="4" className="fill-primary" />
      {/* 얼굴 */}
      <circle cx="59" cy="46" r="4.5" className="fill-on-brand" />
      <circle cx="81" cy="46" r="4.5" className="fill-on-brand" />
      <path
        d="M58 58 Q70 66 82 58"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        className="text-on-brand"
      />

      {/* 팔 (스톱워치를 들고 있는 형태) */}
      <path d="M40 90 Q22 88 18 72" stroke="currentColor" strokeWidth={7} strokeLinecap="round" fill="none" className="text-primary" />
      <path d="M100 90 Q112 84 112 70" stroke="currentColor" strokeWidth={7} strokeLinecap="round" fill="none" className="text-primary" />

      {/* 스톱워치 */}
      <circle cx="112" cy="58" r="18" className="fill-surface stroke-primary" strokeWidth={4} />
      <circle cx="112" cy="58" r="12" className="fill-bg" />
      <line x1="112" y1="58" x2="112" y2="49" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="text-primary" />
      <line x1="112" y1="58" x2="118" y2="58" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="text-primary" />
      <rect x="107" y="34" width="10" height="6" rx="2" className="fill-primary" />
    </svg>
  );
}

export default function SpeedyWritePromo() {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-hairline bg-accent/10 p-5 sm:flex-row sm:gap-6 sm:p-6">
      <div className="h-24 w-24 shrink-0 sm:h-28 sm:w-28">
        <SpeedyMascot />
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center sm:items-start sm:text-left">
        <p className="text-lg font-bold leading-snug text-ink sm:text-xl">
          블로그 쓰는 데 1~2시간 허비하지 마세요
        </p>
        <p className="text-sm text-ink-muted sm:text-base">
          사진과 한 줄 프롬프트만 있으면, AI가 <span className="font-semibold text-primary">3분</span> 만에 완성해드려요
        </p>
      </div>
    </div>
  );
}
