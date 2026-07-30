import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { categorizeLandingPage, categorizeReferrer } from "./lib/utils/visitTracking";

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

    // 오늘의 첫 방문에서만 리퍼러/진입 페이지를 캡처 — 카테고리화는 여기서
    // 미리 해서(고정된 소수의 값으로) Notion select 옵션이 URL마다 하나씩
    // 늘어나지 않게 함.
    const referrer = categorizeReferrer(request.headers.get("referer"), origin);
    const landingPage = categorizeLandingPage(pathname);

    // 공개 도메인(origin, https://ezzsearch.com)으로 자기 자신을 다시 호출하면
    // Railway 컨테이너 내부에서 TLS 핸드셰이크가 깨짐(실측 확인 — "SSL
    // routines:ssl3_get_record:wrong version number" 에러로 계속 조용히
    // 실패해서 방문 기록이 하나도 안 쌓이고 있었음, 반면 브라우저가 직접
    // 보내는 /api/search 같은 요청은 이 경로를 안 타서 멀쩡했음). 같은
    // 프로세스 안에서 도는 호출이니 로컬 루프백으로 보내면 TLS 자체가
    // 필요 없어져서 이 문제를 피해간다.
    //
    // fire-and-forget이지만 waitUntil로 감싸서, 응답이 먼저 나가도 이 fetch가
    // 중간에 끊기지 않고 끝까지 실행되게 함(Vercel Edge Function과 동일한
    // 배경 작업 패턴).
    const port = process.env.PORT ?? "3000";
    event.waitUntil(
      fetch(`http://127.0.0.1:${port}/api/visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, referrer, landingPage }),
      }).catch((err) => {
        console.error("[middleware] visit fetch failed:", err);
      })
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt|html)$).*)",
  ],
};
