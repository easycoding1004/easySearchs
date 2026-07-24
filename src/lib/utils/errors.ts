// Supabase/Postgrest errors are plain objects ({ message, code, details,
// hint }), not real Error instances, so `err instanceof Error` misses them
// and `String(err)` on a plain object just gives "[object Object]".
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
