// Minimal Server-Sent-Events helper for streaming step-by-step progress from
// a slow Route Handler (Naver's shared rate limit makes multi-keyword
// searches take several seconds) instead of leaving the client with only a
// static "검색 중..." label for the whole request.
export function createSseStream() {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });

  function send(data: Record<string, unknown>) {
    controllerRef.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  }

  function close() {
    controllerRef.close();
  }

  return { stream, send, close };
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};
