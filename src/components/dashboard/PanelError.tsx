export default function PanelError({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-dashed border-error bg-surface p-5 text-sm text-error">
      <h2 className="mb-1 text-base font-semibold text-ink">{title}</h2>
      <p>
        일시적으로 데이터를 불러오지 못했습니다 (네이버 API 요청 제한일 수 있어요).
        잠시 후 새로고침해 주세요.
      </p>
    </section>
  );
}
