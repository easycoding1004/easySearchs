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

  // 2026-08 수정(사용자 신고 — "방문자수가 실제 조회수만큼 잡히는 것 같다")
  // — Next.js가 뷰포트에 보이는 모든 <Link>를 자동으로 프리페치하는데(예:
  // SiteHeader 내비게이션 10개 항목), 이 프리페치 요청도 미들웨어를 그대로
  // 통과해서 지금까지 "방문"으로 잡히고 있었음. 실제 클릭 네비게이션과 달리
  // 프리페치 요청은 next-router-prefetch 헤더가 붙는다는 걸 Next.js 소스
  // (app-router-headers.d.ts, 이 프로젝트가 쓰는 Next 16.2.11 기준)로 확인함
  // — 특히 신규 방문자가 페이지에 처음 들어온 순간, 방문 쿠키를 세팅한
  // 응답이 브라우저에 아직 반영되기 전에 여러 링크의 프리페치가 거의
  // 동시에 발생하면 전부 "쿠키 없음"으로 보여서 각각 별도 방문으로
  // 중복 등록됐을 가능성이 높음. 프리페치 요청은 여기서 아예 건너뛰어서
  // 실제 네비게이션(클릭/최초 진입)만 방문으로 집계되게 함.
  const isPrefetch =
    request.headers.get("next-router-prefetch") !== null ||
    request.headers.get("next-router-segment-prefetch") !== null ||
    request.headers.get("purpose") === "prefetch";
  if (isPrefetch) {
    return NextResponse.next();
  }

  // 2026-08 수정(사용자 신고 — "실 방문자 수와 통계가 일치하지 않는다") —
  // 지금까지 봇 필터가 전혀 없어서 검색엔진 크롤러(구글봇·네이버 예티·빙봇
  // 등)와 각종 스크래퍼·모니터링 도구의 요청이 전부 방문으로 집계되고
  // 있었음. 크롤러는 쿠키를 저장하지 않으므로 크롤링된 페이지 하나하나가
  // 각각 "새 방문자"로 잡힘 — 통계가 실제보다 부풀려진 주원인으로 추정.
  // 유료화 판단 기준(일 신규방문자)이 이 숫자에 걸려 있고, 키워드 SEO
  // 페이지 확장으로 크롤러 트래픽이 크게 늘어날 예정이라 필터가 필수임.
  const userAgent = request.headers.get("user-agent") ?? "";
  // "bot"이 대부분의 크롤러(googlebot/bingbot/twitterbot/linkedinbot 등)를
  // 잡고, 나머지는 bot 토큰이 없는 알려진 크롤러·스크래퍼·HTTP 클라이언트만
  // 추가함. 인앱 브라우저(카카오톡/인스타그램 등)가 오탐으로 걸리는 토큰은
  // 넣지 말 것 — 한국 트래픽은 인앱 브라우저 비중이 높음.
  const BOT_UA_PATTERN =
    /bot|crawl|spider|slurp|yeti|bingpreview|daumoa|kakaotalk-scrap|facebookexternalhit|whatsapp|semrush|ahrefs|bytespider|claude-web|amazonbot|applebot|headlesschrome|lighthouse|pagespeed|uptime|curl|wget|python|axios|node-fetch|go-http-client|okhttp|scrapy|java\/|libwww/i;
  if (!userAgent || BOT_UA_PATTERN.test(userAgent)) {
    return NextResponse.next();
  }

  // 실제 사용자의 "페이지 진입"만 방문으로 인정 —
  // - GET이 아닌 요청(POST 등)은 페이지 진입이 아님.
  // - sec-fetch-mode가 있는데 navigate가 아니면(클라이언트 라우팅 RSC fetch,
  //   임베드 배지 <img> 요청 등) 문서 네비게이션이 아님. 헤더가 아예 없는
  //   구형 브라우저는 오탐으로 제외하지 않도록 "있으면서 다를 때"만 거름.
  // - RSC 헤더가 붙은 요청은 클라이언트 사이드 전환이라 별도 방문이 아님
  //   (쿠키가 차단된 브라우저에서 페이지 전환마다 방문이 중복 집계되는 것 방지).
  const secFetchMode = request.headers.get("sec-fetch-mode");
  const isDocumentNavigation =
    request.method === "GET" &&
    (secFetchMode === null || secFetchMode === "navigate") &&
    request.headers.get("rsc") === null;
  if (!isDocumentNavigation) {
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
