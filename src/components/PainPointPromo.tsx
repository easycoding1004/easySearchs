import Reveal from "@/components/Reveal";

export interface PainPoint {
  question: string;
  title: string;
  points: string[];
}

function Avatar() {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/25 text-on-brand">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="40" height="16" viewBox="0 0 40 16" fill="none" className="hidden shrink-0 text-ink-muted sm:block">
      <line x1="0" y1="8" x2="30" y2="8" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      <path
        d="M28 3l6 5-6 5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PainPointRow({ point }: { point: PainPoint }) {
  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
      <div className="flex items-center gap-3">
        <Avatar />
        <div className="rounded-2xl rounded-tl-sm border border-hairline bg-surface px-4 py-3 text-sm font-medium text-ink shadow-sm">
          {point.question}
        </div>
      </div>

      <div className="flex justify-center py-1 sm:py-0">
        <Arrow />
      </div>

      <div className="rounded-2xl bg-ink p-5 text-white">
        <h3 className="mb-3 text-base font-bold">{point.title}</h3>
        <ul className="flex flex-col gap-2">
          {point.points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-white/90">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-white">
                ✓
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PainPointPromo({
  heading,
  subheading,
  points,
}: {
  heading: string;
  subheading?: string;
  points: PainPoint[];
}) {
  return (
    <section className="w-full border-t border-hairline bg-surface px-4 py-16 sm:px-6 sm:py-20">
      <Reveal className="mx-auto flex max-w-4xl flex-col gap-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{heading}</h2>
          {subheading && <p className="text-sm text-ink-muted sm:text-base">{subheading}</p>}
        </div>
        <div className="flex flex-col gap-6">
          {points.map((p) => (
            <PainPointRow key={p.question} point={p} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
