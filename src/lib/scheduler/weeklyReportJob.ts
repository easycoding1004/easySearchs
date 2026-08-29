import { fetchTrendingKeywordsWithNaverVolume } from "../googleTrends/client";
import { getRisingKeywords } from "../notion/keywordSnapshots";
import { createBoardPost, findLatestBoardPostByTitlePrefix } from "../notion/board";
import { WEEKLY_REPORT_MIN_GAP_DAYS } from "../constants";

// 2026-08 유입 전략(활성 신호) — 매주 "이번 주 뜨는 검색어" 데이터 요약을
// 게시판에 자동 발행해 게시판에 정기적인 심장박동을 만듦. §18.7.1의 원칙
// ("가짜 회원 활동 금지, 정직한 운영자 명의만") 그대로: 가상 인물이 아니라
// "이지서치" 명의로, 본문에 자동 발행 리포트임을 명시하고, 데이터가 없으면
// 발행하지 않음(없는 내용을 지어내지 않음).
//
// 발송 이력은 별도 저장소 없이 게시판 자체를 조회해 판정 —
// findLatestBoardPostByTitlePrefix로 마지막 리포트 날짜를 확인하므로,
// 뉴스레터 잡(§6.4)의 "배포가 잦으면 주기가 영영 안 참" 트레이드오프 없이
// 부팅 시 즉시 실행해도 안전함(7일 안 지났으면 그냥 건너뜀).
export const WEEKLY_REPORT_TITLE_PREFIX = "[주간 키워드 리포트]";

const TOP_TRENDING_COUNT = 10;
const TOP_RISING_COUNT = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatVolume(pc: number | null, mobile: number | null): string {
  if (pc == null || mobile == null) return "";
  const total = pc + mobile;
  return total > 0 ? ` — 월간 검색 ${total.toLocaleString("ko-KR")}회` : " — 월간 검색 10회 미만";
}

export async function runWeeklyReportJob(): Promise<void> {
  // 1) 최근 발행 확인 — 7일 안 지났으면 아무것도 안 함.
  try {
    const latest = await findLatestBoardPostByTitlePrefix(WEEKLY_REPORT_TITLE_PREFIX);
    if (latest?.createdAt) {
      const ageDays = (Date.now() - new Date(latest.createdAt).getTime()) / MS_PER_DAY;
      if (ageDays < WEEKLY_REPORT_MIN_GAP_DAYS) {
        return;
      }
    }
  } catch (err) {
    // 가드 확인 자체가 실패하면 중복 발행 위험이 있으니 발행하지 않음.
    console.error("[weeklyReportJob] dedup check failed, skipping:", err);
    return;
  }

  // 2) 데이터 수집 — 급상승(구글 트렌드+네이버 검색량)이 핵심 재료.
  const [trending, rising] = await Promise.all([
    fetchTrendingKeywordsWithNaverVolume().catch(() => []),
    getRisingKeywords().catch(() => []),
  ]);

  if (trending.length === 0) {
    console.log("[weeklyReportJob] no trending data — skipping this week");
    return;
  }

  // 3) 본문 구성 — Notion rich_text 한 객체 2000자 제한 안에 넉넉히 듦.
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateLabel = `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`;

  const lines: string[] = [];
  lines.push("이번 주 화제 검색어를 데이터로 정리했어요. 다음 글감을 고를 때 참고해 보세요.");
  lines.push("");
  lines.push("■ 요즘 뜨는 검색어 TOP " + Math.min(trending.length, TOP_TRENDING_COUNT));
  trending.slice(0, TOP_TRENDING_COUNT).forEach((item, i) => {
    lines.push(`${i + 1}. ${item.title}${formatVolume(item.naverPcCount, item.naverMobileCount)}`);
  });

  const topRising = rising.slice(0, TOP_RISING_COUNT);
  if (topRising.length > 0) {
    lines.push("");
    lines.push("■ 검색량이 꾸준히 오르는 키워드");
    topRising.forEach((item, i) => {
      lines.push(
        `${i + 1}. ${item.keyword} — ${item.earliestCount.toLocaleString("ko-KR")}회 → ${item.latestCount.toLocaleString("ko-KR")}회 (+${Math.round(item.changeRatio * 100)}%)`
      );
    });
  }

  lines.push("");
  lines.push(
    "※ 이 글은 이지서치가 매주 자동으로 발행하는 데이터 리포트예요. 화제 검색어는 구글 트렌드(한국) 기준이고, 검색량은 네이버 검색광고 API로 조회한 실제 월간 검색수예요. 각 키워드의 검색량 추이는 사이트의 키워드 사전에서 확인할 수 있어요."
  );

  // 4) 발행 — "이지서치" 명의, authorId 빈 문자열(시스템 발행이라 어떤
  // 회원의 mypage에도 귀속되지 않음).
  try {
    await createBoardPost({
      title: `${WEEKLY_REPORT_TITLE_PREFIX} ${dateLabel} 이번 주 뜨는 검색어`,
      body: lines.join("\n"),
      authorNickname: "이지서치",
      authorId: "",
      imageUploadIds: [],
    });
    console.log("[weeklyReportJob] posted weekly report");
  } catch (err) {
    console.error("[weeklyReportJob] failed to post report:", err);
  }
}
