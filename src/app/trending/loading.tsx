import SiteHeader from "@/components/SiteHeader";

// /trending has no shared layout.tsx (unlike /dashboard/*), so SiteHeader
// must be rendered here too — otherwise the header would flicker/disappear
// during this loading state instead of staying put. Without this file,
// clicking "더보기" into /trending showed nothing happening at all while
// the live Google Trends/rising-keyword fetch ran, which read as the page
// being stuck — same "왜 안 뜨지" problem the /dashboard/[sessionId]
// loading.tsx was built to solve.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center">
        <section className="flex w-full flex-col items-center gap-4 px-4 py-16 sm:px-6 sm:py-20">
          <div className="h-7 w-40 animate-pulse rounded-full bg-hairline" />
          <div className="h-10 w-64 animate-pulse rounded bg-hairline sm:h-12 sm:w-96" />
          <div className="h-4 w-72 animate-pulse rounded bg-hairline sm:w-96" />
        </section>

        <section className="w-full border-t border-hairline bg-surface px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            <div className="h-6 w-40 animate-pulse rounded bg-hairline" />
            <div className="h-48 w-full animate-pulse rounded-lg bg-hairline" />
          </div>
        </section>

        <section className="w-full px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            <div className="h-6 w-48 animate-pulse rounded bg-hairline" />
            <div className="h-48 w-full animate-pulse rounded-lg bg-hairline" />
          </div>
        </section>
      </main>
    </div>
  );
}
