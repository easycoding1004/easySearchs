import SiteHeader from "@/components/SiteHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import WeeklySearchLogCards from "@/components/admin/WeeklySearchLogCards";
import WeeklyBlogScoreLogCards from "@/components/admin/WeeklyBlogScoreLogCards";
import WeeklySignupLogCards from "@/components/admin/WeeklySignupLogCards";
import VisitBreakdownCard from "@/components/admin/VisitBreakdownCard";
import { countSessionsToday, getSessionsInRange } from "@/lib/notion/sessions";
import { countBlogScoreSessionsToday, getBlogScoreSessionsInRange } from "@/lib/notion/blogScoreSessions";
import { countInquiriesToday } from "@/lib/notion/inquiries";
import { countUsersToday, getUsersInRange } from "@/lib/notion/users";
import { countVisitsToday, getVisitBreakdownToday, type VisitBreakdown } from "@/lib/notion/visits";

export const dynamic = "force-dynamic";

const WEEKLY_LOG_DAYS = 7;

// 패널 하나가 실패해도 나머지 통계는 뜨게 격리 (dashboard/[sessionId]의
// settle() 패턴과 동일).
async function settle<T>(fetcher: () => Promise<T>): Promise<T | null> {
  try {
    return await fetcher();
  } catch (err) {
    console.error("[AdminPage] stat fetch failed:", err);
    return null;
  }
}

const EMPTY_VISIT_BREAKDOWN: VisitBreakdown = { total: 0, byReferrer: [], byLandingPage: [] };

export default async function AdminPage() {
  const [
    searchCount,
    visitCount,
    inquiryCount,
    blogScoreCount,
    signupCount,
    weeklySessions,
    weeklyBlogScoreSessions,
    weeklySignups,
    visitBreakdown,
  ] = await Promise.all([
    settle(countSessionsToday),
    settle(countVisitsToday),
    settle(countInquiriesToday),
    settle(countBlogScoreSessionsToday),
    settle(countUsersToday),
    getSessionsInRange(WEEKLY_LOG_DAYS).catch(() => []),
    getBlogScoreSessionsInRange(WEEKLY_LOG_DAYS).catch(() => []),
    getUsersInRange(WEEKLY_LOG_DAYS).catch(() => []),
    settle(getVisitBreakdownToday),
  ]);

  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">관리자</h1>
            <p className="text-sm text-ink-muted">오늘 하루의 활동을 한눈에 확인하세요.</p>
          </div>
          <AdminLogoutButton />
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <AdminStatCard label="오늘 키워드 검색" value={searchCount ?? 0} />
          <AdminStatCard label="오늘 방문자" value={visitCount ?? 0} />
          <AdminStatCard
            label="오늘 문의 메일"
            value={inquiryCount ?? 0}
            footnote="Notion 기록 기준"
          />
          <AdminStatCard label="오늘 블로그지수 확인" value={blogScoreCount ?? 0} />
          <AdminStatCard label="오늘 회원가입" value={signupCount ?? 0} />
        </div>

        {/* 방문자 유입 분석은 자체적으로 2열 세부 표를 갖고 있어 카드 하나를
            통째로 차지하게 두고, 나머지 "최근 7일" 로그 카드 3개를 그
            아래에서 나란히 배치 — 예전처럼 섹션마다 전체 폭으로 세로
            나열되지 않게 카드형 대시보드 그리드로 재구성함(2026-08,
            사용자 요청). */}
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <h2 className="text-base font-semibold text-ink">방문자 유입 분석</h2>
          <VisitBreakdownCard
            byReferrer={(visitBreakdown ?? EMPTY_VISIT_BREAKDOWN).byReferrer}
            byLandingPage={(visitBreakdown ?? EMPTY_VISIT_BREAKDOWN).byLandingPage}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h2 className="text-base font-semibold text-ink">최근 {WEEKLY_LOG_DAYS}일 회원가입</h2>
            <WeeklySignupLogCards users={weeklySignups} />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h2 className="text-base font-semibold text-ink">최근 {WEEKLY_LOG_DAYS}일 검색 키워드</h2>
            <WeeklySearchLogCards sessions={weeklySessions} />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h2 className="text-base font-semibold text-ink">최근 {WEEKLY_LOG_DAYS}일 블로그지수 확인</h2>
            <WeeklyBlogScoreLogCards sessions={weeklyBlogScoreSessions} />
          </div>
        </div>
      </main>
    </div>
  );
}
