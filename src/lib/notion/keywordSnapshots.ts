import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { SNAPSHOT_PROPS, SNAPSHOT_SOURCE } from "./schema";
import { getKstDateString } from "../utils/formatDate";
import { createTtlCache } from "../utils/ttlCache";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function snapshotsDataSourceId(): string {
  return requireEnv("NOTION_KEYWORD_SNAPSHOTS_DB_ID");
}

type SnapshotSource = (typeof SNAPSHOT_SOURCE)[keyof typeof SNAPSHOT_SOURCE];

// 같은 키워드+같은 날짜 조합은 갱신, 없으면 새로 생성 — 하루 동안 반복
// 검색되어도 행이 계속 늘어나지 않게 함.
export async function upsertSnapshot(
  keyword: string,
  pcCount: number,
  mobileCount: number,
  source: SnapshotSource
): Promise<void> {
  const dataSourceId = snapshotsDataSourceId();
  const today = getKstDateString();

  const existing = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      and: [
        { property: SNAPSHOT_PROPS.title, title: { equals: keyword } },
        { property: SNAPSHOT_PROPS.collectedAt, date: { equals: today } },
      ],
    },
    page_size: 1,
  });

  const properties = {
    [SNAPSHOT_PROPS.pcCount]: { type: "number" as const, number: pcCount },
    [SNAPSHOT_PROPS.mobileCount]: { type: "number" as const, number: mobileCount },
    [SNAPSHOT_PROPS.collectedAt]: { type: "date" as const, date: { start: today } },
    [SNAPSHOT_PROPS.source]: { type: "select" as const, select: { name: source } },
  };

  const existingPage = existing.results[0];
  if (existingPage) {
    await notion.pages.update({ page_id: existingPage.id, properties });
    return;
  }

  await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: {
      [SNAPSHOT_PROPS.title]: {
        type: "title",
        title: [{ type: "text", text: { content: keyword } }],
      },
      ...properties,
    },
  });
}

interface RawSnapshot {
  keyword: string;
  totalCount: number;
  collectedAt: string; // YYYY-MM-DD
}

function parseSnapshot(page: PageObjectResponse): RawSnapshot | null {
  const props = page.properties;

  const titleProp = props[SNAPSHOT_PROPS.title];
  const keyword =
    titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";
  if (!keyword) return null;

  const pcProp = props[SNAPSHOT_PROPS.pcCount];
  const pcCount = pcProp?.type === "number" ? pcProp.number ?? 0 : 0;

  const mobileProp = props[SNAPSHOT_PROPS.mobileCount];
  const mobileCount = mobileProp?.type === "number" ? mobileProp.number ?? 0 : 0;

  const dateProp = props[SNAPSHOT_PROPS.collectedAt];
  const collectedAt = dateProp?.type === "date" ? dateProp.date?.start ?? "" : "";
  if (!collectedAt) return null;

  return { keyword, totalCount: pcCount + mobileCount, collectedAt };
}

export interface RisingKeyword {
  keyword: string;
  earliestCount: number;
  latestCount: number;
  earliestDate: string;
  latestDate: string;
  changeRatio: number; // (latest - earliest) / earliest
}

// 스냅샷 DB 전체를 필터 없이 페이지네이션하며 훑는 무거운 계산이라(스냅샷 잡이
// 12시간마다+검색할 때마다 계속 행을 추가하므로 시간이 지날수록 느려짐),
// /trending 방문마다 매번 다시 계산하지 않도록 캐싱 — 원본 스냅샷은 최소
// 12시간 주기로만 바뀌니 1시간 캐시로도 신선도 문제 없음.
const CACHE_TTL_MS = 60 * 60 * 1000;
const risingKeywordsCache = createTtlCache<number, RisingKeyword[]>(CACHE_TTL_MS);

// 키워드별로 가장 오래된 스냅샷과 최신 스냅샷을 비교 — 최소 minDays 이상
// 간격이 벌어진 것만(하루 이틀 만에 생긴 우연한 변동을 "급상승"으로 오인하지
// 않도록), 증가율 내림차순 정렬.
export async function getRisingKeywords(minDays = 20): Promise<RisingKeyword[]> {
  const cached = risingKeywordsCache.get(minDays);
  if (cached) return cached;

  const dataSourceId = snapshotsDataSourceId();
  const byKeyword = new Map<string, RawSnapshot[]>();

  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results.filter(isFullPage) as PageObjectResponse[]) {
      const snapshot = parseSnapshot(page);
      if (!snapshot) continue;
      const list = byKeyword.get(snapshot.keyword) ?? [];
      list.push(snapshot);
      byKeyword.set(snapshot.keyword, list);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const results: RisingKeyword[] = [];

  for (const [keyword, snapshots] of byKeyword) {
    if (snapshots.length < 2) continue;
    snapshots.sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
    const earliest = snapshots[0];
    const latest = snapshots[snapshots.length - 1];

    const spanDays =
      (new Date(latest.collectedAt).getTime() - new Date(earliest.collectedAt).getTime()) /
      MS_PER_DAY;
    if (spanDays < minDays) continue;
    if (earliest.totalCount <= 0) continue;

    const changeRatio = (latest.totalCount - earliest.totalCount) / earliest.totalCount;
    if (changeRatio <= 0) continue;

    results.push({
      keyword,
      earliestCount: earliest.totalCount,
      latestCount: latest.totalCount,
      earliestDate: earliest.collectedAt,
      latestDate: latest.collectedAt,
      changeRatio,
    });
  }

  const sorted = results.sort((a, b) => b.changeRatio - a.changeRatio);
  risingKeywordsCache.set(minDays, sorted);
  return sorted;
}
