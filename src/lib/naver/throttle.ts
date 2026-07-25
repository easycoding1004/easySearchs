// Naver's Open API rate limit turned out much stricter than typical (250ms
// spacing still triggered 429s) — pace every outgoing request to this same
// Naver app (Open API search + both DataLab APIs all share
// NAVER_OPENAPI_CLIENT_ID/SECRET, so they likely share one quota bucket) to
// at least this far apart instead of only reacting to 429s after the fact.
const MIN_REQUEST_INTERVAL_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// `nextAvailableAt` is reserved synchronously (read+write with no `await`
// between them) so concurrent callers can't race on it — JS never
// interleaves two calls mid-function, only at an actual await boundary,
// and the reservation happens before this function's first one. An earlier
// "read lastRequestAt, sleep, then write lastRequestAt" version raced when
// multiple requests called throttle() around the same tick (e.g. a /result
// page mounting several panels that each hit a DataLab route at once): they
// could all read the same stale timestamp and wake up together, defeating
// the spacing (found by real timing — 5 calls meant to be 1s apart all
// landed within ~2s). This also keeps the "server was idle, fire
// immediately" case free of an unnecessary first-call delay, which a naive
// promise-chain fix would have added.
let nextAvailableAt = 0;

export function throttle(): Promise<void> {
  const now = Date.now();
  const scheduledAt = Math.max(now, nextAvailableAt);
  nextAvailableAt = scheduledAt + MIN_REQUEST_INTERVAL_MS;

  const wait = scheduledAt - now;
  return wait > 0 ? sleep(wait) : Promise.resolve();
}
