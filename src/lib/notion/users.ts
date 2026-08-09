import { randomUUID } from "node:crypto";
import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { USER_PROPS, AUTH_PROVIDER, SUBSCRIPTION_STATUS } from "./schema";
import { countRowsMatching } from "./queryHelpers";
import { getKstDateString, kstDayRangeUtcIso } from "../utils/formatDate";

export type AuthProviderValue = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];
export type SubscriptionStatusValue = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

// 토스페이먼츠 월 구독제(2026-08 추가) — AI 블로그 자동글쓰기 무료 3회/유료
// 월 10회, 블로그지수 AI 인사이트는 유료회원 전용. CLAUDE.md 신규 섹션 참고.
export const FREE_WRITE_USE_LIMIT = 3;
export const MONTHLY_WRITE_USE_LIMIT = 10;
export const SUBSCRIPTION_MONTHLY_AMOUNT = 9900;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function usersDataSourceId(): string {
  return requireEnv("NOTION_USERS_DB_ID");
}

export interface User {
  pageId: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationToken: string;
  sessionToken: string;
  // 레거시(2026-08 토스페이먼츠 월 구독제로 canUseWrite/recordWriteUse가
  // 대체함) — 하루 1회 제한이던 시절의 흔적, 더 이상 안 읽고 안 씀.
  lastUsedAt: string; // KST date string (YYYY-MM-DD), "" if never used
  authProvider: AuthProviderValue | "";
  providerId: string;
  naverBlogId: string;
  nickname: string;
  createdAt: string; // ISO — 관리자 대시보드 가입 현황용
  subscriptionStatus: SubscriptionStatusValue | "";
  cancelPending: boolean;
  tossCustomerKey: string;
  tossBillingKey: string;
  nextBillingDate: string; // ISO date, "" if none
  freeUsesUsed: number;
  monthlyUsesUsed: number;
}

function parseUser(page: PageObjectResponse): User {
  const props = page.properties;

  const titleProp = props[USER_PROPS.title];
  const email = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  const hashProp = props[USER_PROPS.passwordHash];
  const passwordHash =
    hashProp?.type === "rich_text" ? hashProp.rich_text.map((t) => t.plain_text).join("") : "";

  const verifiedProp = props[USER_PROPS.emailVerified];
  const emailVerified = verifiedProp?.type === "checkbox" ? verifiedProp.checkbox : false;

  const verifyTokenProp = props[USER_PROPS.verificationToken];
  const verificationToken =
    verifyTokenProp?.type === "rich_text"
      ? verifyTokenProp.rich_text.map((t) => t.plain_text).join("")
      : "";

  const sessionTokenProp = props[USER_PROPS.sessionToken];
  const sessionToken =
    sessionTokenProp?.type === "rich_text"
      ? sessionTokenProp.rich_text.map((t) => t.plain_text).join("")
      : "";

  const lastUsedProp = props[USER_PROPS.lastUsedAt];
  const lastUsedAt = lastUsedProp?.type === "date" ? lastUsedProp.date?.start ?? "" : "";

  const providerProp = props[USER_PROPS.authProvider];
  const authProvider =
    providerProp?.type === "select" ? (providerProp.select?.name as AuthProviderValue) ?? "" : "";

  const providerIdProp = props[USER_PROPS.providerId];
  const providerId =
    providerIdProp?.type === "rich_text" ? providerIdProp.rich_text.map((t) => t.plain_text).join("") : "";

  const naverBlogIdProp = props[USER_PROPS.naverBlogId];
  const naverBlogId =
    naverBlogIdProp?.type === "rich_text" ? naverBlogIdProp.rich_text.map((t) => t.plain_text).join("") : "";

  const nicknameProp = props[USER_PROPS.nickname];
  const nickname = nicknameProp?.type === "rich_text" ? nicknameProp.rich_text.map((t) => t.plain_text).join("") : "";

  const createdAtProp = props[USER_PROPS.createdAt];
  const createdAt = createdAtProp?.type === "date" ? createdAtProp.date?.start ?? "" : "";

  const subStatusProp = props[USER_PROPS.subscriptionStatus];
  const subscriptionStatus =
    subStatusProp?.type === "select" ? (subStatusProp.select?.name as SubscriptionStatusValue) ?? "" : "";

  const cancelPendingProp = props[USER_PROPS.cancelPending];
  const cancelPending = cancelPendingProp?.type === "checkbox" ? cancelPendingProp.checkbox : false;

  const tossCustomerKeyProp = props[USER_PROPS.tossCustomerKey];
  const tossCustomerKey =
    tossCustomerKeyProp?.type === "rich_text"
      ? tossCustomerKeyProp.rich_text.map((t) => t.plain_text).join("")
      : "";

  const tossBillingKeyProp = props[USER_PROPS.tossBillingKey];
  const tossBillingKey =
    tossBillingKeyProp?.type === "rich_text" ? tossBillingKeyProp.rich_text.map((t) => t.plain_text).join("") : "";

  const nextBillingDateProp = props[USER_PROPS.nextBillingDate];
  const nextBillingDate = nextBillingDateProp?.type === "date" ? nextBillingDateProp.date?.start ?? "" : "";

  const freeUsesUsedProp = props[USER_PROPS.freeUsesUsed];
  const freeUsesUsed = freeUsesUsedProp?.type === "number" ? freeUsesUsedProp.number ?? 0 : 0;

  const monthlyUsesUsedProp = props[USER_PROPS.monthlyUsesUsed];
  const monthlyUsesUsed = monthlyUsesUsedProp?.type === "number" ? monthlyUsesUsedProp.number ?? 0 : 0;

  return {
    pageId: page.id,
    email,
    passwordHash,
    emailVerified,
    verificationToken,
    sessionToken,
    lastUsedAt,
    authProvider,
    providerId,
    naverBlogId,
    nickname,
    createdAt,
    subscriptionStatus,
    cancelPending,
    tossCustomerKey,
    tossBillingKey,
    nextBillingDate,
    freeUsesUsed,
    monthlyUsesUsed,
  };
}

export async function findUserBySessionToken(token: string): Promise<User | null> {
  if (!token) return null;
  const res = await notion.dataSources.query({
    data_source_id: usersDataSourceId(),
    filter: { property: USER_PROPS.sessionToken, rich_text: { equals: token } },
    page_size: 1,
  });
  const page = res.results.find(isFullPage);
  return page ? parseUser(page) : null;
}

// Looked up by (provider, providerId) rather than email — a social login's
// email can be absent/change, but the provider's own user id doesn't.
export async function findUserByProvider(
  provider: AuthProviderValue,
  providerId: string
): Promise<User | null> {
  const res = await notion.dataSources.query({
    data_source_id: usersDataSourceId(),
    filter: {
      and: [
        { property: USER_PROPS.authProvider, select: { equals: provider } },
        { property: USER_PROPS.providerId, rich_text: { equals: providerId } },
      ],
    },
    page_size: 1,
  });
  const page = res.results.find(isFullPage);
  return page ? parseUser(page) : null;
}

// 네이버/카카오/구글 로그인 — 발급처가 이미 신원을 확인했으므로 emailVerified를
// 바로 true로 세팅하고 별도 인증 메일을 안 보냄. 비밀번호 로그인 자체가
// 없어졌으니(2026-08) passwordHash는 항상 빈 문자열. 반환값은 세션 발급까지
// 바로 이어갈 수 있게 pageId.
export async function createSocialUser(
  email: string,
  provider: AuthProviderValue,
  providerId: string
): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: usersDataSourceId() },
    properties: {
      [USER_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: email } }] },
      [USER_PROPS.emailVerified]: { type: "checkbox", checkbox: true },
      [USER_PROPS.authProvider]: { type: "select", select: { name: provider } },
      [USER_PROPS.providerId]: { type: "rich_text", rich_text: [{ type: "text", text: { content: providerId } }] },
      [USER_PROPS.createdAt]: { type: "date", date: { start: new Date().toISOString() } },
    },
  });
  return page.id;
}

// One active session per account (MVP scope — logging in again elsewhere
// invalidates any previous session, since this overwrites the token).
export async function setSession(pageId: string): Promise<string> {
  const sessionToken = randomUUID();
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.sessionToken]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: sessionToken } }],
      },
      [USER_PROPS.sessionIssuedAt]: { type: "date", date: { start: new Date().toISOString() } },
    },
  });
  return sessionToken;
}

export async function clearSession(pageId: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.sessionToken]: { type: "rich_text", rich_text: [] },
    },
  });
}

export async function setNaverBlogId(pageId: string, naverBlogId: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.naverBlogId]: {
        type: "rich_text",
        rich_text: naverBlogId ? [{ type: "text", text: { content: naverBlogId } }] : [],
      },
    },
  });
}

// 게시판 글·댓글에 공개로 보일 닉네임 — 로그인용 이메일과 분리(§CLAUDE.md
// 16, USER_PROPS.nickname 주석 참고).
export async function setNickname(pageId: string, nickname: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.nickname]: {
        type: "rich_text",
        rich_text: nickname ? [{ type: "text", text: { content: nickname } }] : [],
      },
    },
  });
}

export function isPaidSubscriber(user: User): boolean {
  return user.subscriptionStatus === SUBSCRIPTION_STATUS.paid;
}

export interface WriteUsageStatus {
  allowed: boolean;
  reason: "free_exhausted" | "monthly_exhausted" | null;
  isPaid: boolean;
}

// AI 블로그 자동글쓰기 사용 가능 여부 — 무료회원 누적 3회(FREE_WRITE_USE_LIMIT),
// 유료회원 결제주기당 10회(MONTHLY_WRITE_USE_LIMIT). 관리자 예외는 이 함수가
// 모르는 영역 그대로 호출부(/api/write)에서 isAdminAuthed()로 따로 처리.
export function canUseWrite(user: User): WriteUsageStatus {
  const isPaid = isPaidSubscriber(user);
  if (isPaid) {
    const allowed = user.monthlyUsesUsed < MONTHLY_WRITE_USE_LIMIT;
    return { allowed, reason: allowed ? null : "monthly_exhausted", isPaid: true };
  }
  const allowed = user.freeUsesUsed < FREE_WRITE_USE_LIMIT;
  return { allowed, reason: allowed ? null : "free_exhausted", isPaid: false };
}

// 실제로 Claude 호출까지 성공했을 때만 호출할 것(§CLAUDE.md 16의 기존 원칙과
// 동일 — 실패한 시도까지 사용 횟수를 깎으면 안 됨). 무료/유료 여부에 따라
// 서로 다른 카운터를 올림.
export async function recordWriteUse(user: User): Promise<void> {
  const isPaid = isPaidSubscriber(user);
  const prop = isPaid ? USER_PROPS.monthlyUsesUsed : USER_PROPS.freeUsesUsed;
  const nextCount = (isPaid ? user.monthlyUsesUsed : user.freeUsesUsed) + 1;
  await notion.pages.update({
    page_id: user.pageId,
    properties: { [prop]: { type: "number", number: nextCount } },
  });
}

// 토스 결제 인증 성공 콜백(/api/billing/confirm)이 쿼리로 받은 customerKey로
// 어느 사용자였는지 역으로 찾을 때 씀 — 세션 쿠키가 아니라 리다이렉트 쿼리
// 파라미터만 갖고 오는 흐름이라 이 조회가 필요함.
export async function findUserByTossCustomerKey(customerKey: string): Promise<User | null> {
  if (!customerKey) return null;
  const res = await notion.dataSources.query({
    data_source_id: usersDataSourceId(),
    filter: { property: USER_PROPS.tossCustomerKey, rich_text: { equals: customerKey } },
    page_size: 1,
  });
  const page = res.results.find(isFullPage);
  return page ? parseUser(page) : null;
}

export async function setTossCustomerKey(pageId: string, customerKey: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.tossCustomerKey]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: customerKey } }],
      },
    },
  });
}

// 카드 등록+첫 결제 성공 시(/api/billing/confirm) 호출 — 구독을 활성화하고
// 이번달사용횟수를 0으로 리셋. billingJob의 매달 정기 청구 성공 시에도 그대로
// 재사용함(구독상태는 이미 유료라 select 값이 바뀌지 않을 뿐 나머지는 동일).
export async function activateSubscription(
  pageId: string,
  params: { billingKey: string; nextBillingDate: string }
): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.subscriptionStatus]: { type: "select", select: { name: SUBSCRIPTION_STATUS.paid } },
      [USER_PROPS.tossBillingKey]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: params.billingKey } }],
      },
      [USER_PROPS.nextBillingDate]: { type: "date", date: { start: params.nextBillingDate } },
      [USER_PROPS.monthlyUsesUsed]: { type: "number", number: 0 },
      [USER_PROPS.cancelPending]: { type: "checkbox", checkbox: false },
    },
  });
}

// billingJob의 매달 정기 청구 성공 시 — 이미 유료 상태이므로 구독상태는 안
// 건드리고 결제주기만 다음 달로 미루고 사용횟수를 리셋.
export async function renewSubscription(pageId: string, nextBillingDate: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.nextBillingDate]: { type: "date", date: { start: nextBillingDate } },
      [USER_PROPS.monthlyUsesUsed]: { type: "number", number: 0 },
    },
  });
}

// 무료로 강등 — 해지 예약이 다음 결제일에 실제로 반영될 때(billingJob)와,
// 정기 청구 자체가 실패했을 때(카드 만료 등, MVP는 유예 기간 없이 즉시 강등)
// 양쪽에서 재사용.
export async function downgradeToFree(pageId: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.subscriptionStatus]: { type: "select", select: { name: SUBSCRIPTION_STATUS.free } },
      [USER_PROPS.cancelPending]: { type: "checkbox", checkbox: false },
    },
  });
}

// 구독 해지 버튼 — 즉시 무료 전환이 아니라 "다음 결제일에 청구하지 말고
// 무료로 전환하라"는 예약만 세움(이미 낸 이번 달 혜택은 유지). 실제 전환은
// billingJob이 다음결제일에 이 플래그를 보고 처리.
export async function setCancelPending(pageId: string, pending: boolean): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: { [USER_PROPS.cancelPending]: { type: "checkbox", checkbox: pending } },
  });
}

// billingJob이 매일 훑는 대상 — 구독상태=유료 AND 다음결제일이 오늘(KST)
// 이전. 조건이 하나뿐이라(날짜 범위가 아니라 단일 on_or_before) §CLAUDE.md
// 15의 date AND 필터 버그(on_or_after+before를 한 조건에 같이 넣으면 안
// 묶이는 문제)는 해당 없음 — select 조건과 묶을 때만 and로 쪼갬.
export async function getUsersWithBillingDue(): Promise<User[]> {
  const today = getKstDateString();
  const users: User[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: usersDataSourceId(),
      filter: {
        and: [
          { property: USER_PROPS.subscriptionStatus, select: { equals: SUBSCRIPTION_STATUS.paid } },
          { property: USER_PROPS.nextBillingDate, date: { on_or_before: today } },
        ],
      },
      start_cursor: cursor,
      page_size: 100,
    });
    users.push(...res.results.filter(isFullPage).map(parseUser));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return users;
}

// 관리자 대시보드 "총 가입자" 카드용 — 필터 없이 DB 전체를 센다(2026-08 추가).
export async function countAllUsers(): Promise<number> {
  return countRowsMatching(usersDataSourceId());
}

// 관리자 대시보드 "오늘 회원가입" 카드용 — §CLAUDE.md 15의 Notion 날짜
// 필터 AND 버그(on_or_after+before를 한 조건에 같이 넣으면 안 묶임)와
// 같은 이유로 두 조건을 and로 쪼갬(sessions.ts의 countSessionsToday와
// 동일 패턴).
export async function countUsersToday(): Promise<number> {
  const { startIso, endIso } = kstDayRangeUtcIso(0);
  return countRowsMatching(usersDataSourceId(), {
    and: [
      { property: USER_PROPS.createdAt, date: { on_or_after: startIso } },
      { property: USER_PROPS.createdAt, date: { before: endIso } },
    ],
  });
}

// 관리자 대시보드 "최근 N일 회원가입" 카드 로그용 — sessions.ts의
// getSessionsInRange와 동일 패턴(days=7이면 오늘 포함 최근 7일).
export async function getUsersInRange(days: number): Promise<User[]> {
  const { startIso } = kstDayRangeUtcIso(days - 1);
  const users: User[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: usersDataSourceId(),
      filter: { property: USER_PROPS.createdAt, date: { on_or_after: startIso } },
      sorts: [{ property: USER_PROPS.createdAt, direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    users.push(...res.results.filter(isFullPage).map(parseUser));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return users;
}
