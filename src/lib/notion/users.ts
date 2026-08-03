import { randomUUID } from "node:crypto";
import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { USER_PROPS, AUTH_PROVIDER } from "./schema";
import { getKstDateString } from "../utils/formatDate";

export type AuthProviderValue = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];

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
  lastUsedAt: string; // KST date string (YYYY-MM-DD), "" if never used
  authProvider: AuthProviderValue | "";
  providerId: string;
  naverBlogId: string;
  nickname: string;
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
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const res = await notion.dataSources.query({
    data_source_id: usersDataSourceId(),
    filter: { property: USER_PROPS.title, title: { equals: email } },
    page_size: 1,
  });
  const page = res.results.find(isFullPage);
  return page ? parseUser(page) : null;
}

export async function findUserByVerificationToken(token: string): Promise<User | null> {
  const res = await notion.dataSources.query({
    data_source_id: usersDataSourceId(),
    filter: { property: USER_PROPS.verificationToken, rich_text: { equals: token } },
    page_size: 1,
  });
  const page = res.results.find(isFullPage);
  return page ? parseUser(page) : null;
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

// Returns the raw verification token so the caller (signup route) can email
// it — Notion is the source of truth, this function doesn't send mail itself.
export async function createUser(email: string, passwordHash: string): Promise<string> {
  const verificationToken = randomUUID();
  await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: usersDataSourceId() },
    properties: {
      [USER_PROPS.title]: { type: "title", title: [{ type: "text", text: { content: email } }] },
      [USER_PROPS.passwordHash]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: passwordHash } }],
      },
      [USER_PROPS.emailVerified]: { type: "checkbox", checkbox: false },
      [USER_PROPS.verificationToken]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: verificationToken } }],
      },
      [USER_PROPS.authProvider]: { type: "select", select: { name: AUTH_PROVIDER.email } },
      [USER_PROPS.createdAt]: { type: "date", date: { start: new Date().toISOString() } },
    },
  });
  return verificationToken;
}

// 네이버/카카오 로그인 — 발급처가 이미 신원을 확인했으므로 emailVerified를
// 바로 true로 세팅하고 별도 인증 메일을 안 보냄. 비밀번호 자체가 없는
// 계정이라 passwordHash는 빈 문자열로 둠(로그인 라우트가 이메일+비밀번호
// 계정과 구분해서 처리). 반환값은 세션 발급까지 바로 이어갈 수 있게 pageId.
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

export async function markEmailVerified(pageId: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.emailVerified]: { type: "checkbox", checkbox: true },
      // Consumed once — a stale verification link shouldn't keep working.
      [USER_PROPS.verificationToken]: { type: "rich_text", rich_text: [] },
    },
  });
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

// KST-day-based, matching every other "오늘" boundary in this app
// (formatDate.ts's getKstDateString) rather than a rolling 24h window.
export function hasUsedToday(user: User): boolean {
  return user.lastUsedAt === getKstDateString();
}

export async function markUsedToday(pageId: string): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [USER_PROPS.lastUsedAt]: { type: "date", date: { start: getKstDateString() } },
    },
  });
}
