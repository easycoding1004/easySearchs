// Reads a `text/event-stream` response body and invokes onMessage for each
// parsed JSON event. Pairs with src/lib/utils/sse.ts on the server side.
export async function readSseStream(
  res: Response,
  onMessage: (data: Record<string, unknown>) => void
): Promise<void> {
  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith("data:")) continue;
      try {
        onMessage(JSON.parse(line.slice("data:".length).trim()));
      } catch {
        // Ignore malformed chunks rather than aborting the whole stream.
      }
    }
  }
}
