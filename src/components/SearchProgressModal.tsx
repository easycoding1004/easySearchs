export default function SearchProgressModal({
  status,
  progress,
}: {
  status: string | null;
  progress: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-ink">검색 중...</span>
          <span className="text-sm font-semibold text-primary">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-spring"
            style={{ width: `${progress}%` }}
          />
        </div>
        {status && <p className="mt-3 min-h-[1.25em] text-sm text-ink-muted">{status}</p>}
      </div>
    </div>
  );
}
