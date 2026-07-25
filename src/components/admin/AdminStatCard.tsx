export default function AdminStatCard({
  label,
  value,
  footnote,
}: {
  label: string;
  value: number;
  footnote?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface p-4">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <span className="text-2xl font-bold text-ink">{value.toLocaleString()}</span>
      {footnote && <span className="text-[11px] text-ink-muted">{footnote}</span>}
    </div>
  );
}
