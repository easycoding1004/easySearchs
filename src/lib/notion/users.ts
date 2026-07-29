import { randomUUID } from "node:crypto";
import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { USER_PROPS } from "./schema";
import { getKstDateString } from "../utils/formatDate";

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

  return { pageId: page.id, email, passwordHash, emailVerified, verificationToken, sessionToken, lastUsedAt };
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
      [USER_PROPS.createdAt]: { type: "date", date: { start: new Date().toISOString() } },
    },
  });
  return verificationToken;
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
