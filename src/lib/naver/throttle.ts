// Naver's Open API rate limit turned out much stricter than typical (250ms
// spacing still triggered 429s) — pace every outgoing request to this same
// Naver app (Open API search + both DataLab APIs all share
// NAVER_OPENAPI_CLIENT_ID/SECRET, so they likely share one quota bucket) to
// at least this far apart instead of only reacting to 429s after the fact.
const MIN_REQUEST_INTERVAL_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;
export async function throttle() {
  const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}
