import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import AuthForms from "@/components/AuthForms";
import LogoutButton from "@/components/LogoutButton";
import MySearchHistoryCards from "@/components/mypage/MySearchHistoryCards";
import MyBoardPostCards from "@/components/mypage/MyBoardPostCards";
import MyHotdealPostCards from "@/components/mypage/MyHotdealPostCards";
import { getCurrentUser } from "@/lib/auth/session";
import { getSessionsByAuthor } from "@/lib/notion/sessions";
import { getBoardPostsByAuthor } from "@/lib/notion/board";
import { getHotdealPostsByAuthor } from "@/lib/notion/hotdeal";

export const metadata: Metadata = {
  title: "내 정보",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// 2026-08 추가(사용자 요청 — "로그인이 되면 내정보 버튼, 클릭 시 검색
// 기록정보·게시판별 내 게시물·로그아웃") — /write/history와 같은 패턴으로
// 완전 비공개(robots noindex + 로그인 필수, 비로그인은 AuthForms로 안내).
// 세 목록 다 이 계정으로 로그인한 이후에 작성/검색한 것만 걸림 — 로그인
// 없이 쓴 검색·정책정보 댓글 등은 애초에 계정에 연결된 적이 없어서 여기
// 안 보이는 게 정상(§10.2 원칙).
export default async function MyPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        {user && user.emailVerified ? (
          <MyPageContent userId={user.pageId} email={user.email} nickname={user.nickname} />
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">내 정보</h1>
            <p className="text-center text-xs text-ink-muted">로그인하면 내 정보를 볼 수 있어요.</p>
            <AuthForms />
          </div>
        )}
      </main>
    </div>
  );
}

async function MyPageContent({
  userId,
  email,
  nickname,
}: {
  userId: string;
  email: string;
  nickname: string;
}) {
  const [sessions, boardPosts, hotdealPosts] = await Promise.all([
    getSessionsByAuthor(userId).catch(() => []),
    getBoardPostsByAuthor(userId).catch(() => []),
    getHotdealPostsByAuthor(userId).catch(() => []),
  ]);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">내 정보</h1>
          <p className="mt-1 text-sm text-ink-muted">{nickname || email || "가입된 계정"}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-ink">검색 기록정보</h2>
        <MySearchHistoryCards sessions={sessions} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-ink">게시판 내 게시물</h2>
        <MyBoardPostCards posts={boardPosts} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-ink">핫딜정보 내 게시물</h2>
        <MyHotdealPostCards posts={hotdealPosts} />
      </div>
    </div>
  );
}
