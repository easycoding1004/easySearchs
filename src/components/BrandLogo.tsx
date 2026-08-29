// 2026-08 재설계 — 헤더 로고 교체. 기존 public/ezzsearch_logo.png는 래스터
// "ezzsearch" 워드마크라 화면 브랜드명("이지서치")과 계속 어긋나 있었음.
// 사용자가 공유한 로고 에셋 중 심볼형 로고(코랄 원 + 흰 돋보기 + 앰버 위성
// 원 2개, 구 easySerch 로고)의 시각 언어를 인라인 SVG로 재현하고, 워드마크는
// 이미지가 아니라 실제 텍스트 "이지서치"(Pretendard, on-brand 색 — 원본
// 로고의 진갈색 워드마크와 동일 계열)로 조합함 — 외부 에셋 없이 코드만으로
// 선명하게 렌더링되고, 접근성·SEO에도 실제 텍스트가 더 낫다.
// 색은 전부 브랜드 CSS 변수를 그대로 참조(디자인 토큰 임의 변경 금지 원칙).
export default function BrandLogo({
  iconSize = 30,
  textClassName = "text-lg",
}: {
  iconSize?: number;
  textClassName?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" aria-hidden>
        {/* 메인 코랄 원 */}
        <circle cx="21" cy="23" r="17" fill="var(--color-primary)" />
        {/* 흰 돋보기 */}
        <circle cx="18" cy="19.5" r="6" fill="none" stroke="#ffffff" strokeWidth="3" />
        <line
          x1="22.5"
          y1="24"
          x2="28.5"
          y2="30"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* 앰버 위성 원 2개 — 원본 심볼의 비대칭 악센트 */}
        <circle cx="36.5" cy="34" r="7.5" fill="var(--color-accent)" />
        <circle cx="40.5" cy="9" r="3.5" fill="var(--color-accent)" />
      </svg>
      <span className={`font-extrabold tracking-tight text-on-brand ${textClassName}`}>이지서치</span>
    </span>
  );
}
