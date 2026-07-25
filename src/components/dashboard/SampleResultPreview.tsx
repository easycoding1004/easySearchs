import BlogScorePanel from "./BlogScorePanel";
import KeywordClusterPanel from "./KeywordClusterPanel";
import {
  SAMPLE_SCORES,
  SAMPLE_GAPS,
  SAMPLE_FETCHED_AT,
  SAMPLE_PROFILE_STATS,
  SAMPLE_AVG_RECENT_COMMENTS,
  SAMPLE_TOP_TERMS,
  SAMPLE_SEED,
  SAMPLE_NODES,
  SAMPLE_RECOMMENDATION,
  SAMPLE_COMPETITOR_PROFILES,
} from "@/lib/dashboard/sampleBlogScoreData";

// 실제 BlogScorePanel/KeywordClusterPanel 컴포넌트를 고정 예시 데이터로 그대로
// 렌더링 — 디자인이 바뀌면 이 예시도 자동으로 같이 바뀐다. 실제 조회 결과와
// 헷갈리지 않도록 배지와 워터마크 스타일 오버레이로 "예시"임을 계속 표시.
export default function SampleResultPreview() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white">
          예시 화면 (실제 데이터 아님)
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          이런 식으로 결과를 보여드려요
        </h2>
        <p className="max-w-md text-sm text-ink-muted">
          아래는 가상의 카페 블로그로 만든 예시예요. 실제로 조회하면 입력하신 블로그 기준으로
          똑같은 화면이 나와요.
        </p>
      </div>

      <div className="relative">
        <div className="pointer-events-none select-none opacity-90">
          <BlogScorePanel
            scores={SAMPLE_SCORES}
            gaps={SAMPLE_GAPS}
            fetchedAt={SAMPLE_FETCHED_AT}
            profileStats={SAMPLE_PROFILE_STATS}
            avgRecentComments={SAMPLE_AVG_RECENT_COMMENTS}
            topTerms={SAMPLE_TOP_TERMS}
          />
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none select-none opacity-90">
          <KeywordClusterPanel
            seed={SAMPLE_SEED}
            nodes={SAMPLE_NODES}
            inferredKeywords={[]}
            recommendation={SAMPLE_RECOMMENDATION}
            competitorProfiles={SAMPLE_COMPETITOR_PROFILES}
            fetchedAt={SAMPLE_FETCHED_AT}
          />
        </div>
      </div>
    </div>
  );
}
