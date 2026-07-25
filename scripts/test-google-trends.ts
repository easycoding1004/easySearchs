import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchTrendingKeywordsKR } from "../src/lib/googleTrends/client";
import { fetchKeywordStats } from "../src/lib/naver/client";

async function main() {
  const items = await fetchTrendingKeywordsKR();
  console.log(`구글 트렌드 항목 ${items.length}개 수신\n`);

  for (const item of items.slice(0, 5)) {
    console.log(`- ${item.title} (관심도 ${item.approxTraffic || "?"}, 시작 ${item.startedAt})`);
    console.log(`  관련 뉴스 ${item.newsItems.length}건: ${item.newsItems[0]?.title ?? "-"}`);
  }

  console.log("\n네이버 실제 검색량 교차 조회 (상위 3개):");
  for (const item of items.slice(0, 3)) {
    // hintKeywords 파라미터는 공백을 포함하면 400 에러를 낸다 (실측 확인).
    const bareKeyword = item.title.replace(/\s+/g, "");
    try {
      const rows = await fetchKeywordStats(bareKeyword);
      const match = rows.find((r) => r.relKeyword === bareKeyword);
      if (match) {
        console.log(
          `- ${item.title}: PC ${match.monthlyPcQcCnt} / 모바일 ${match.monthlyMobileQcCnt}`
        );
      } else {
        console.log(`- ${item.title}: 네이버 데이터 없음 (연관 키워드 ${rows.length}개 수신)`);
      }
    } catch (err) {
      console.log(`- ${item.title}: 네이버 조회 실패 (${(err as Error).message})`);
    }
  }
}

main().catch((err) => {
  console.error("검증 실패:", err);
  process.exit(1);
});
