import { isFullPage } from "@notionhq/client";
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
// 방문"이라는 신호라 여기선 중복 확인 없이 바로 1행 생성. referrer/
// landingPage는 proxy.ts가 이미 categorizeReferrer/categorizeLandingPage로
// 정규화한 값(select 옵션으로 쓸 수 있게 소수의 고정 카테고리) — 여기서는
// 그대로 저장만 한다.
export async function recordVisit(
  visitorId: string,
  referrer: string,
  landingPage: string
): Promise<void> {
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
      [VISIT_PROPS.referrer]: {
        type: "select",
        select: { name: referrer },
      },
      [VISIT_PROPS.landingPage]: {
        type: "select",
        select: { name: landingPage },
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

export interface VisitBreakdownEntry {
  label: string;
  count: number;
}

export interface VisitBreakdown {
  total: number;
  byReferrer: VisitBreakdownEntry[];
  byLandingPage: VisitBreakdownEntry[];
}

function tally(counts: Map<string, number>, label: string) {
  counts.set(label, (counts.get(label) ?? 0) + 1);
}

function toSortedEntries(counts: Map<string, number>): VisitBreakdownEntry[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// Notion has no server-side GROUP BY, so this pages through today's visits
// once (same query shape as countVisitsToday) and tallies referrer/landing
// page in JS — fine at this scale since "오늘" is always a narrow filter.
export async function getVisitBreakdownToday(): Promise<VisitBreakdown> {
  const today = getKstDateString();
  const byReferrer = new Map<string, number>();
  const byLandingPage = new Map<string, number>();
  let total = 0;
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: visitsDataSourceId(),
      filter: { property: VISIT_PROPS.visitedAt, date: { equals: today } },
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of res.results.filter(isFullPage)) {
      total++;
      const referrerProp = page.properties[VISIT_PROPS.referrer];
      tally(byReferrer, referrerProp?.type === "select" ? referrerProp.select?.name ?? "알 수 없음" : "알 수 없음");

      const landingProp = page.properties[VISIT_PROPS.landingPage];
      tally(byLandingPage, landingProp?.type === "select" ? landingProp.select?.name ?? "알 수 없음" : "알 수 없음");
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return { total, byReferrer: toSortedEntries(byReferrer), byLandingPage: toSortedEntries(byLandingPage) };
}
