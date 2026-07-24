// In-memory TTL cache, shared across every visitor within a single Node
// process. Only correct on a persistent server (one long-lived process) —
// on serverless, each cold-started instance would get its own cache, which
// defeats the point. See categoryTrends.ts for the original of this pattern.
export function createTtlCache<K, V>(ttlMs: number) {
  const cache = new Map<K, { value: V; fetchedAt: number }>();

  return {
    get(key: K): V | undefined {
      const entry = cache.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.fetchedAt >= ttlMs) {
        cache.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: K, value: V) {
      cache.set(key, { value, fetchedAt: Date.now() });
    },
  };
}
