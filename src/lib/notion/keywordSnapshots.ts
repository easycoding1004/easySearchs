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
  pcCount: number;
  mobileCount: number;
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

  return { keyword, pcCount, mobileCount, totalCount: pcCount + mobileCount, collectedAt };
}

// 스냅샷 DB 전체를 필터 없이 페이지네이션하며 훑는 무거운 스캔(스냅샷이
// 쌓일수록 느려짐)을 급상승 계산(/trending)과 키워드 사전(/keyword, 2026-08
// 재설계 유입 전략)이 공유함 — 각자 따로 스캔하면 비용이 두 배가 되므로
// 스캔 결과 자체를 캐싱하고, 두 소비자는 인메모리 계산만 함. 키워드별
// 스냅샷 목록은 날짜 오름차순으로 정렬해서 반환.
const SCAN_CACHE_TTL_MS = 60 * 60 * 1000;
const snapshotScanCache = createTtlCache<string, Map<string, RawSnapshot[]>>(SCAN_CACHE_TTL_MS);

async function scanSnapshotsByKeyword(): Promise<Map<string, RawSnapshot[]>> {
  const cached = snapshotScanCache.get("all");
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

  for (const list of byKeyword.values()) {
    list.sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
  }

  snapshotScanCache.set("all", byKeyword);
  return byKeyword;
}

export interface RisingKeyword {
  keyword: string;
  earliestCount: number;
  latestCount: number;
  earliestDate: string;
  latestDate: string;
  changeRatio: number; // (latest - earliest) / earliest
}

// 키워드별로 가장 오래된 스냅샷과 최신 스냅샷을 비교 — 최소 minDays 이상
// 간격이 벌어진 것만(하루 이틀 만에 생긴 우연한 변동을 "급상승"으로 오인하지
// 않도록), 증가율 내림차순 정렬. 무거운 DB 스캔은 scanSnapshotsByKeyword()의
// 1시간 캐시가 흡수하고(원본 스냅샷은 최소 12시간 주기로만 바뀌니 신선도
// 문제 없음 — 실측 5.5초→0.3초), 여기서는 인메모리 계산만 함.
export async function getRisingKeywords(minDays = 20): Promise<RisingKeyword[]> {
  const byKeyword = await scanSnapshotsByKeyword();

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const results: RisingKeyword[] = [];

  for (const [keyword, snapshots] of byKeyword) {
    if (snapshots.length < 2) continue;
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

  return results.sort((a, b) => b.changeRatio - a.changeRatio);
}

// ---------- 키워드 사전 (`/keyword/*`, 2026-08 재설계 유입 전략) ----------

export interface KeywordDirectoryEntry {
  keyword: string;
  latestCount: number;
  latestDate: string;
  snapshotCount: number;
}

// 스냅샷이 1건이라도 있는 모든 키워드 — 키워드 사전 목록 페이지·sitemap·
// "비슷한 키워드" 내부 링크의 데이터 원천. 최신 검색량 내림차순.
export async function getKeywordDirectory(): Promise<KeywordDirectoryEntry[]> {
  const byKeyword = await scanSnapshotsByKeyword();
  const entries: KeywordDirectoryEntry[] = [];
  for (const [keyword, snapshots] of byKeyword) {
    const latest = snapshots[snapshots.length - 1];
    entries.push({
      keyword,
      latestCount: latest.totalCount,
      latestDate: latest.collectedAt,
      snapshotCount: snapshots.length,
    });
  }
  return entries.sort((a, b) => b.latestCount - a.latestCount);
}

export interface KeywordSnapshotPoint {
  collectedAt: string; // YYYY-MM-DD
  pcCount: number;
  mobileCount: number;
  totalCount: number;
}

// 키워드 하나의 스냅샷 이력 — 사전 상세 페이지용. 전체 스캔이 아니라
// title 필터가 걸린 단건 쿼리라 가벼움. 페이지가 크롤러에게 반복 조회되는
// 특성상(SEO 랜딩) 6시간 TTL 캐시로 Notion 재조회를 줄임 — 스냅샷 자체가
// 12시간 주기로만 갱신되니 신선도 문제 없음.
const HISTORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const historyCache = createTtlCache<string, KeywordSnapshotPoint[]>(HISTORY_CACHE_TTL_MS);

export async function getKeywordSnapshotHistory(keyword: string): Promise<KeywordSnapshotPoint[]> {
  const cached = historyCache.get(keyword);
  if (cached) return cached;

  const res = await notion.dataSources.query({
    data_source_id: snapshotsDataSourceId(),
    filter: { property: SNAPSHOT_PROPS.title, title: { equals: keyword } },
    sorts: [{ property: SNAPSHOT_PROPS.collectedAt, direction: "ascending" }],
    page_size: 100,
  });

  const points: KeywordSnapshotPoint[] = [];
  for (const page of res.results.filter(isFullPage) as PageObjectResponse[]) {
    const snapshot = parseSnapshot(page);
    if (!snapshot) continue;
    points.push({
      collectedAt: snapshot.collectedAt,
      pcCount: snapshot.pcCount,
      mobileCount: snapshot.mobileCount,
      totalCount: snapshot.totalCount,
    });
  }

  historyCache.set(keyword, points);
  return points;
}
