export default function DatalabTrendPanel({
  status,
}: {
  status: "pending_approval" | "error";
}) {
  return (
    <section className="rounded-lg border border-dashed border-hairline bg-surface p-5 text-sm text-ink-muted">
      <h2 className="mb-1 text-base font-semibold text-ink">데이터랩 쇼핑인사이트</h2>
      {status === "pending_approval" ? (
        <p>
          네이버 데이터랩(쇼핑인사이트) API는 심사 승인 대기 중입니다. 승인 후 이 자리에
          카테고리 클릭 추이·연령/성별 데이터가 표시됩니다.
        </p>
      ) : (
        <p>데이터랩 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      )}
    </section>
  );
}
