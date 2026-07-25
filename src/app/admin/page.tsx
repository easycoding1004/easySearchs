import SiteHeader from "@/components/SiteHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import WeeklySearchLogCards from "@/components/admin/WeeklySearchLogCards";
import { countSessionsToday, getSessionsInRange } from "@/lib/notion/sessions";
import { countBlogScoreSessionsToday } from "@/lib/notion/blogScoreSessions";
import { countInquiriesToday } from "@/lib/notion/inquiries";
import { countVisitsToday } from "@/lib/notion/visits";

export const dynamic = "force-dynamic";

const WEEKLY_LOG_DAYS = 7;

// 패널 하나가 실패해도 나머지 통계는 뜨게 격리 (dashboard/[sessionId]의
// settle() 패턴과 동일).
async function settle(fetcher: () => Promise<number>): Promise<number | null> {
  try {
    return await fetcher();
  } catch (err) {
    console.error("[AdminPage] stat fetch failed:", err);
    return null;
  }
}

export default async function AdminPage() {
  const [searchCount, visitCount, inquiryCount, blogScoreCount, weeklySessions] =
    await Promise.all([
      settle(countSessionsToday),
      settle(countVisitsToday),
      settle(countInquiriesToday),
      settle(countBlogScoreSessionsToday),
      getSessionsInRange(WEEKLY_LOG_DAYS).catch(() => []),
    ]);

  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">관리자</h1>
            <p className="text-sm text-ink-muted">오늘 하루의 활동을 한눈에 확인하세요.</p>
          </div>
          <AdminLogoutButton />
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <AdminStatCard label="오늘 키워드 검색" value={searchCount ?? 0} />
          <AdminStatCard label="오늘 방문자" value={visitCount ?? 0} />
          <AdminStatCard
            label="오늘 문의 메일"
            value={inquiryCount ?? 0}
            footnote="Notion 기록 기준"
          />
          <AdminStatCard label="오늘 블로그지수 확인" value={blogScoreCount ?? 0} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-ink">최근 {WEEKLY_LOG_DAYS}일 검색 키워드</h2>
          <WeeklySearchLogCards sessions={weeklySessions} />
        </div>
      </main>
    </div>
  );
}
