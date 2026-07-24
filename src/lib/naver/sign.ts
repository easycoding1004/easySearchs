import { createHmac } from "crypto";

export function getTimestamp(): string {
  return Date.now().toString();
}

// uri must be the bare path only (e.g. "/keywordstool") — no host, no query
// string. Signing the full URL is a common mistake that fails silently with
// a 401 from Naver.
export function generateSignature(
  timestamp: string,
  method: string,
  uri: string,
  secretKey: string
): string {
  const message = `${timestamp}.${method}.${uri}`;
  return createHmac("sha256", secretKey).update(message).digest("base64");
}
