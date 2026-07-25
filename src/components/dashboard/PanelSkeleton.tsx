export default function PanelSkeleton({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="h-32 w-full animate-pulse rounded-md bg-hairline" />
    </section>
  );
}
