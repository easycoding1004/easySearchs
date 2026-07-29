import { findUserByVerificationToken, markEmailVerified } from "@/lib/notion/users";
import { getErrorMessage } from "@/lib/utils/errors";

function htmlPage(message: string, showLoginLink: boolean): Response {
  return new Response(
    `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>이메일 인증 — 이지서치</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:-apple-system,'Noto Sans KR',sans-serif;background:#FFFBF7;">
  <div style="text-align:center;padding:24px;">
    <p style="font-size:16px;color:#3D2E1F;">${message}</p>
    ${showLoginLink ? '<a href="https://ezzsearch.com/write" style="color:#E06B3D;font-size:14px;">로그인하러 가기</a>' : ""}
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return htmlPage("잘못된 요청이에요.", false);

  try {
    const user = await findUserByVerificationToken(token);
    if (!user) return htmlPage("이미 인증됐거나 만료된 링크예요.", true);

    await markEmailVerified(user.pageId);
    return htmlPage("이메일 인증이 완료됐어요! 이제 로그인할 수 있어요.", true);
  } catch (err) {
    console.error("[GET /api/auth/verify] failed:", getErrorMessage(err), err);
    return htmlPage("인증 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.", false);
  }
}
