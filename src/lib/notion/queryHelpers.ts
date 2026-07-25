import { notion } from "./client";

type QueryFilter = NonNullable<
  Parameters<typeof notion.dataSources.query>[0]["filter"]
>;

// Notion API에는 "개수만" 세는 엔드포인트가 없어서 페이지네이션하며 직접
// 센다 — 오늘/최근 N일처럼 범위가 좁은 필터라 보통 한두 페이지로 끝남.
export async function countRowsMatching(
  dataSourceId: string,
  filter: QueryFilter
): Promise<number> {
  let count = 0;
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter,
      start_cursor: cursor,
      page_size: 100,
    });
    count += res.results.length;
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return count;
}
