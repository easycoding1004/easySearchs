import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getKeywordDirectory } from "@/lib/notion/keywordSnapshots";

export const metadata: Metadata = {
  title: "키워드 사전",
  description:
    "이지서치에서 실제로 조회된 네이버 키워드들의 월간 검색량을 모아봤어요. 키워드를 클릭하면 검색량 추이와 비슷한 키워드를 확인할 수 있어요.",
};

export const dynamic = "force-dynamic";

const TOP_KEYWORDS_SHOWN = 120;

// 2026-08 재설계(유입 전략) — 개별 키워드 페이지(/keyword/[keyword])의 목록
// 허브. 데이터는 이미 쌓이고 있는 `키워드 검색량 스냅샷` DB에서만 서빙하므로
// 네이버 API를 추가로 호출하지 않음(스로틀 제약과 무관). /keywords(업종별
// 인기 검색어, 복수형)와는 다른 페이지이니 혼동 주의.
export default async function KeywordDirectoryPage() {
  const directory = await getKeywordDirectory().catch(() => []);
  const top = directory.slice(0, TOP_KEYWORDS_SHOWN);

  return (
    <div className="flex flex-1 flex-col font-sans">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">키워드 사전</h1>
          <p className="max-w-2xl text-sm text-ink-muted sm:text-base">
            이지서치에서 실제로 조회된 키워드 {directory.length.toLocaleString("ko-KR")}개의
            네이버 월간 검색량을 모아봤어요. 키워드를 클릭하면 검색량 추이와 비슷한 키워드를
            볼 수 있어요. 찾는 키워드가 없다면{" "}
            <Link href="/search" className="font-medium text-primary hover:underline">
              검색량 조회
            </Link>
            에서 직접 조회해보세요 — 조회된 키워드는 사전에 자동으로 추가돼요.
          </p>
        </div>

        {top.length === 0 ? (
          <div className="rounded-lg border border-hairline bg-surface p-8 text-center text-sm text-ink-muted">
            아직 수집된 키워드가 없어요.{" "}
            <Link href="/search" className="font-medium text-primary hover:underline">
              첫 키워드를 조회해보세요 →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold tracking-tight text-ink">검색량 많은 키워드</h2>
            <div className="flex flex-wrap gap-2">
              {top.map((entry) => (
                <Link
                  key={entry.keyword}
                  href={`/keyword/${encodeURIComponent(entry.keyword)}`}
                  className="flex items-baseline gap-1.5 rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-sm transition hover:border-primary"
                >
                  <span className="font-medium text-ink">{entry.keyword}</span>
                  <span className="text-xs text-ink-muted">
                    {entry.latestCount > 0 ? entry.latestCount.toLocaleString("ko-KR") : "10 미만"}
                  </span>
                </Link>
              ))}
            </div>
            {directory.length > TOP_KEYWORDS_SHOWN && (
              <p className="text-xs text-ink-muted">
                외 {(directory.length - TOP_KEYWORDS_SHOWN).toLocaleString("ko-KR")}개 키워드가 더
                있어요 — 각 키워드 페이지의 &quot;비슷한 키워드&quot;로 이어서 찾아볼 수 있어요.
              </p>
            )}
          </div>
        )}

        <p className="rounded-lg border border-hairline bg-surface p-4 text-xs text-ink-muted">
          검색량은 네이버 검색광고 API 기준 월간 검색수(PC+모바일)로, 각 키워드가 마지막으로
          조회·수집된 시점의 값이에요. 실시간 수치가 필요하면 검색량 조회에서 직접 확인해 주세요.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
