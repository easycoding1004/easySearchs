import { notFound } from "next/navigation";
import KeywordChart from "@/components/search/KeywordChart";
import KeywordTable from "@/components/search/KeywordTable";
import SearchTrendPanel from "@/components/search/SearchTrendPanel";
import KeywordAudiencePanel from "@/components/search/KeywordAudiencePanel";
import ShareResultButton from "@/components/ShareResultButton";
import KeywordWatchButton from "@/components/search/KeywordWatchButton";
import SiteHeader from "@/components/SiteHeader";
import BoardPromptLink from "@/components/BoardPromptLink";
import { getRecordsForSession } from "@/lib/notion/records";
import { getSessionById } from "@/lib/notion/sessions";
import { KEYWORD_KIND } from "@/lib/notion/schema";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Ephemeral, one-off per search — shouldn't compete for search-result
// placement against the evergreen landing pages.
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function ResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const session = await getSessionById(sessionId);
  if (!session) notFound();

  const [records, user] = await Promise.all([getRecordsForSession(sessionId), getCurrentUser()]);
  const seedKeyword = records.find((r) => r.kind === KEYWORD_KIND.seed)?.keyword;
  const seedRecords = records
    .filter((r) => r.kind === KEYWORD_KIND.seed)
    .map((r) => ({ keyword: r.keyword, totalCount: r.totalCount }));

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {session.title}
            </h1>
            <p className="text-sm text-ink-muted">
              검색 키워드: {session.keyword} · 결과 {records.length}건
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareResultButton title={session.title} />
            <a
              href={`/api/session/${sessionId}/csv`}
              className="self-start rounded-md border border-hairline px-4 py-2 text-sm font-medium text-ink transition ease-spring hover:bg-bg motion-safe:active:scale-[0.97] sm:self-auto"
            >
              CSV 다운로드
            </a>
          </div>
        </div>

        {records.some((r) => r.kind === "추론 키워드") && (
          <p className="text-sm text-ink-muted">
            네이버 연관 키워드가 적어, 구분이 &quot;추론 키워드&quot;로 표시된
            항목은 이 키워드로 검색되는 블로그 글 제목에서 자주 나오는
            단어를 뽑아 실제 검색량을 조회한 결과예요.
          </p>
        )}

        <KeywordWatchButton loggedIn={!!user} seedKeywords={seedRecords} />

        <KeywordChart records={records} />
        <KeywordTable records={records} />
        <SearchTrendPanel sessionId={sessionId} />
        {seedKeyword && <KeywordAudiencePanel keyword={seedKeyword} />}
        <BoardPromptLink />
      </main>
    </div>
  );
}
