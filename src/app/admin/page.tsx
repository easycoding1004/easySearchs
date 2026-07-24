import SiteHeader from "@/components/SiteHeader";
import RecentSessionsList from "@/components/RecentSessionsList";
import { getRecentSessions } from "@/lib/notion/sessions";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

const HISTORY_LIMIT = 50;

export default async function AdminPage() {
  const sessions = await getRecentSessions(HISTORY_LIMIT);

  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            관리자 · 최근 검색
          </h1>
          <p className="text-sm text-ink-muted">
            최근 {HISTORY_LIMIT}건의 검색 세션이에요.
          </p>
        </div>
        <RecentSessionsList sessions={sessions} />
      </main>
    </div>
  );
}
