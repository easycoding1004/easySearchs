import { unsubscribeByToken } from "@/lib/notion/subscribers";
import { getErrorMessage } from "@/lib/utils/errors";

function htmlPage(message: string): Response {
  return new Response(
    `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>구독 해지 — 이지서치</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:-apple-system,'Noto Sans KR',sans-serif;background:#FFFBF7;">
  <div style="text-align:center;padding:24px;">
    <p style="font-size:16px;color:#3D2E1F;">${message}</p>
    <a href="https://ezzsearch.com" style="color:#E06B3D;font-size:14px;">이지서치로 돌아가기</a>
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return htmlPage("잘못된 요청이에요.");

  try {
    const success = await unsubscribeByToken(token);
    return htmlPage(
      success
        ? "구독이 해지됐어요. 그동안 감사했습니다."
        : "이미 해지됐거나 만료된 링크예요."
    );
  } catch (err) {
    console.error("[GET /api/unsubscribe] failed:", getErrorMessage(err), err);
    return htmlPage("구독 해지 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
  }
}
