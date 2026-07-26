import { ImageResponse } from "next/og";
import { getBlogScoreSessionById } from "@/lib/notion/blogScoreSessions";
import { getRecordsForBlogScoreSession } from "@/lib/notion/blogScoreRecords";
import { compositeScore } from "@/lib/dashboard/contentDiagnostics";
import { createTtlCache } from "@/lib/utils/ttlCache";
import type { RadarScore } from "@/lib/dashboard/contentDiagnostics";

const SIZE = { width: 320, height: 88 };

// The 메인 탭 score is computed once at session creation and never changes
// (§10.1: stored in Notion, not live-recomputed) — a long TTL is safe and
// keeps repeated embeds (this route is meant to be <img>-embedded on other
// people's blogs, so every visitor to THEIR blog would otherwise hit
// Notion) from re-querying every time.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = createTtlCache<string, number | null>(CACHE_TTL_MS);

async function getCompositeScoreForSession(sessionId: string): Promise<number | null> {
  const cached = cache.get(sessionId);
  if (cached !== undefined) return cached;

  const session = await getBlogScoreSessionById(sessionId);
  if (!session) {
    cache.set(sessionId, null);
    return null;
  }

  const records = await getRecordsForBlogScoreSession(sessionId);
  const mine = records.find((r) => r.isMine);
  if (!mine) {
    cache.set(sessionId, null);
    return null;
  }

  const score: RadarScore = {
    domain: mine.domain,
    label: mine.label,
    isMine: mine.isMine,
    postVolume: mine.postVolume,
    keywordCoverage: mine.keywordCoverage,
    highVolumeCoverage: mine.highVolumeCoverage,
    lowCompetitionCoverage: mine.lowCompetitionCoverage,
    exposureRank: mine.exposureRank,
    freshness: mine.freshness,
    engagement: mine.engagement,
  };
  const composite = compositeScore(score);
  cache.set(sessionId, composite);
  return composite;
}

function badgeImage(scoreLabel: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          backgroundColor: "#FFFBF7",
          border: "2px solid #EDE6DD",
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: "#E06B3D" }}>
          ezzsearch
        </div>
        <div
          style={{
            display: "flex",
            marginLeft: 14,
            paddingLeft: 14,
            borderLeft: "1px solid #EDE6DD",
            fontSize: 20,
            fontWeight: 700,
            color: "#3D2E1F",
          }}
        >
          블로그지수 {scoreLabel}
        </div>
      </div>
    ),
    { ...SIZE, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}

// Meant to be embedded elsewhere via <a href="https://ezzsearch.com/dashboard/[sessionId]">
// <img src="https://ezzsearch.com/api/badge/[sessionId]" /></a> — every
// adopting blog is both a backlink and a referral-traffic source back to
// the session's result page.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const composite = await getCompositeScoreForSession(sessionId);
  // compositeScore() is on a 0-100 internal scale (RadarScore's axes are
  // all 0-100) — same /10 conversion BlogScorePanel.tsx uses to show "10점
  // 만점" (e.g. 85 -> "8.5"), so the badge matches what the dashboard itself
  // displays instead of showing the raw 0-100 number.
  const label = composite == null ? "-/10" : `${(composite / 10).toFixed(1)}/10`;
  return badgeImage(label);
}
