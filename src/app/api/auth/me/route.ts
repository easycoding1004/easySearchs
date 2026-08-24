import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

// 2026-08 추가 — SiteHeader가 로그인 여부에 따라 "로그인"/"내 정보"를
// 보여주려면 세션 쿠키(httpOnly라 클라이언트 JS로 직접 못 읽음)를 서버가
// 대신 확인해줘야 함. 처음엔 SiteHeader 자체를 async Server Component로
// 만들어 getCurrentUser()를 직접 불렀는데, 그러면 이 컴포넌트를 쓰는
// 모든 페이지(홈페이지 포함)가 쿠키를 읽는다는 이유로 정적 생성에서
// 빠져 전부 요청마다 서버 렌더링되는 걸 실측(next build)으로 확인함 —
// 이 프로젝트 대부분의 페이지가 완전 공개·무상태라는 원칙(§10.2)과 충돌.
// 그래서 SiteHeader는 다시 순수 정적 컴포넌트로 두고, 로그인 표시만 이
// 가벼운 클라이언트 사이드 fetch로 분리함(AuthNavLink.tsx) — 로그인 여부
// 외에는 아무 정보도 안 줘서(이메일·닉네임 등 없음) 응답 자체가 캐시되거나
// 노출돼도 개인정보 유출 위험이 없음.
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(
    { loggedIn: !!user },
    { headers: { "Cache-Control": "no-store" } }
  );
}
