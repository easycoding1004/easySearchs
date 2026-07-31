import type { BlogPostAnalysis, PostDetail } from "@/lib/naver/blogEngagementScraper";

export interface PostAnalysisEntry {
  domain: string;
  label: string;
  isMine: boolean;
  analysis: BlogPostAnalysis | null;
}

function formatKstDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

function cell(value: number | null): string {
  return value == null ? "-" : value.toLocaleString();
}

const COLUMNS: { key: keyof PostDetail; label: string }[] = [
  { key: "charCount", label: "글자수" },
  { key: "imageCount", label: "이미지" },
  { key: "quoteCount", label: "인용구" },
  { key: "internalLinkCount", label: "내부링크" },
  { key: "externalLinkCount", label: "외부링크" },
  { key: "commentCount", label: "댓글" },
  { key: "reactionCount", label: "공감" },
  { key: "shareCount", label: "공유" },
];

function DomainPostTable({ entry }: { entry: PostAnalysisEntry }) {
  const { analysis } = entry;

  return (
    <div className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {entry.isMine && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
            내 블로그
          </span>
        )}
        <span className="break-all text-sm font-semibold text-ink">{entry.label}</span>
      </div>

      {!analysis || analysis.posts.length === 0 ? (
        <p className="text-sm text-ink-muted">최근 게시물을 확인하지 못했어요 (비공개 블로그이거나 게시물이 없어요).</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="whitespace-nowrap px-4 py-2 sm:px-5">제목</th>
                <th className="whitespace-nowrap px-2 py-2">발행일</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-2 py-2 text-right">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.posts.map((post) => (
                <tr key={post.logNo} className="border-b border-hairline last:border-0">
                  <td className="max-w-[280px] px-4 py-2 sm:px-5">
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-1 text-ink underline decoration-hairline underline-offset-2 hover:text-primary"
                    >
                      {post.title || post.link}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-ink-muted">{formatKstDate(post.pubDate)}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-2 py-2 text-right text-ink">
                      {cell(post[c.key] as number | null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PostAnalysisPanel({ entries }: { entries: PostAnalysisEntry[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-ink">게시글별 분석</h2>
        <p className="text-sm text-ink-muted">
          RSS로 확인 가능한 최근 게시물 기준으로, 방문할 때마다 새로 조회해요(저장되지 않아요).
        </p>
      </div>
      {entries.map((entry) => (
        <DomainPostTable key={entry.domain} entry={entry} />
      ))}
    </div>
  );
}
