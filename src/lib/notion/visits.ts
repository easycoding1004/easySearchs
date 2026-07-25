import { notion } from "./client";
import { VISIT_PROPS } from "./schema";
import { getKstDateString } from "../utils/formatDate";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function visitsDataSourceId(): string {
  return requireEnv("NOTION_VISITS_DB_ID");
}

// 미들웨어가 방문자 쿠키(ez_v)가 없는 요청에서만 호출 — 그 자체가 "오늘 첫
// 방문"이라는 신호라 여기선 중복 확인 없이 바로 1행 생성.
export async function recordVisit(visitorId: string): Promise<void> {
  await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: visitsDataSourceId() },
    properties: {
      [VISIT_PROPS.title]: {
        type: "title",
        title: [{ type: "text", text: { content: visitorId } }],
      },
      [VISIT_PROPS.visitedAt]: {
        type: "date",
        date: { start: getKstDateString() },
      },
    },
  });
}

export async function countVisitsToday(): Promise<number> {
  const today = getKstDateString();
  let count = 0;
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: visitsDataSourceId(),
      filter: { property: VISIT_PROPS.visitedAt, date: { equals: today } },
      start_cursor: cursor,
      page_size: 100,
    });
    count += res.results.length;
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return count;
}
