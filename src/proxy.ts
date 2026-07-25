import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

const ADMIN_COOKIE = "admin_auth";
const VISITOR_COOKIE = "ez_v";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 다음 KST 자정을 절대 UTC 시각으로 변환 — 방문자 쿠키를 여기서 만료시켜서
// 같은 사람이 다음날 다시 오면 "오늘 방문자"로 다시 잡히게 함.
function nextKstMidnightUtc(): Date {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const y = nowKst.getUTCFullYear();
  const m = nowKst.getUTCMonth();
  const d = nowKst.getUTCDate();
  return new Date(Date.UTC(y, m, d + 1) - KST_OFFSET_MS);
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname, origin } = request.nextUrl;

  // 관리자 게이트 — /admin/login 자체는 제외해야 로그인 화면에 들어갈 수 있음.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!cookie || cookie !== process.env.ADMIN_PASSWORD) {
      return NextResponse.redirect(new URL("/admin/login", origin));
    }
    return NextResponse.next();
  }

  // 방문자 카운트 — API/관리자 경로는 "방문"이 아니므로 제외.
  if (pathname.startsWith("/api") || pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  if (!request.cookies.get(VISITOR_COOKIE)) {
    const visitorId = crypto.randomUUID();
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      expires: nextKstMidnightUtc(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    // fire-and-forget이지만 waitUntil로 감싸서, 응답이 먼저 나가도 이 fetch가
    // 중간에 끊기지 않고 끝까지 실행되게 함(Vercel Edge Function과 동일한
    // 배경 작업 패턴).
    event.waitUntil(
      fetch(new URL("/api/visit", origin), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      }).catch((err) => {
        console.error("[middleware] visit fetch failed:", err);
      })
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt)$).*)",
  ],
};
