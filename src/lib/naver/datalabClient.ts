// Naver DataLab Shopping Insight API — reuses the same Open API credentials
// as openApiClient.ts (NAVER_OPENAPI_CLIENT_ID/SECRET). Unlike the search
// APIs (GET + query string), DataLab endpoints are POST + JSON body.

import { throttle } from "./throttle";

const DATALAB_BASE = "https://openapi.naver.com/v1/datalab/shopping";

function requireHeaders() {
  const clientId = process.env.NAVER_OPENAPI_CLIENT_ID;
  const clientSecret = process.env.NAVER_OPENAPI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Naver Open API credentials: NAVER_OPENAPI_CLIENT_ID / NAVER_OPENAPI_CLIENT_SECRET"
    );
  }
  return {
    "X-Naver-Client-Id": clientId,
    "X-Naver-Client-Secret": clientSecret,
    "Content-Type": "application/json",
  };
}

export async function postDatalab<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  await throttle();
  const response = await fetch(`${DATALAB_BASE}${path}`, {
    method: "POST",
    headers: requireHeaders(),
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Naver DataLab API error (${response.status}) at ${path}: ${text}`);
  }
  return JSON.parse(text) as T;
}
