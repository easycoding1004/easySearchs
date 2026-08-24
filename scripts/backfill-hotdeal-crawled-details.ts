// One-off backfill (2026-08, 사용자 요청 — "루리웹 링크를 없애줘, 본문
// 스크래핑 내용을 넣어줘") — 요약/구매링크 상품정보/실제구매링크 가격비교
// 기능을 붙이기 전에 이미 올라와 있던 자동수집 글에 소급 적용. 원본ID
// (sourceId)가 곧 루리웹 게시글 URL이라 그걸로 다시 스크래핑함.
//
// 실행: npx tsx --env-file=.env.local scripts/backfill-hotdeal-crawled-details.ts
// (스크립트 안에서 dotenv.config()로는 안 됨 — src/lib/notion/*.ts가 간접
// import하는 client.ts가 모듈 로드 시점에 즉시 Notion 클라이언트를 만들어서,
// import가 호이스팅되는 ESM에서는 그보다 늦게 실행되는 config()가 소용
// 없음. §CLAUDE.md 18.7.1과 같은 함정 — 이번엔 아예 --env-file로 우회.)
//
// 재실행해도 무해(멱등) — 매번 최신 스크래핑 결과로 덮어씀.
import { getHotdealPosts, updateHotdealPost } from "../src/lib/notion/hotdeal";
import { HOTDEAL_SOURCE } from "../src/lib/notion/schema";
import { buildCrawledDealContent } from "../src/lib/scheduler/hotdealCrawlJob";
import { mapWithConcurrency } from "../src/lib/utils/concurrency";

const CONCURRENCY = 2;

async function main() {
  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;
  let skippedNoSourceId = 0;

  do {
    const { posts, nextCursor } = await getHotdealPosts(cursor);
    const crawled = posts.filter((p) => p.source === HOTDEAL_SOURCE.crawled);

    await mapWithConcurrency(crawled, CONCURRENCY, async (post) => {
      scanned++;
      if (!post.sourceId || post.lowestPrice == null) {
        skippedNoSourceId++;
        return;
      }
      try {
        const content = await buildCrawledDealContent({
          sourceId: post.sourceId,
          title: post.title,
          link: post.sourceId,
          author: post.authorNickname,
          category: "",
          thumbnailUrl: post.thumbnailUrl || null,
          price: post.lowestPrice,
          pubDate: post.postedAt,
        });
        await updateHotdealPost(post.id, content);
        updated++;
        console.log(`updated: ${post.title}`);
      } catch (err) {
        console.error(`failed: ${post.title}`, err);
      }
    });

    cursor = nextCursor ?? undefined;
  } while (cursor);

  console.log(`\nDone. scanned=${scanned} updated=${updated} skipped(no sourceId/price)=${skippedNoSourceId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
