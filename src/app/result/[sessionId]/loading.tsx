export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-56 animate-pulse rounded bg-hairline" />
        <div className="h-4 w-40 animate-pulse rounded bg-hairline" />
      </div>
      <div className="h-80 w-full animate-pulse rounded-lg bg-hairline" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-hairline" />
    </main>
  );
}
