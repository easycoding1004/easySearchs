import { randomUUID } from "node:crypto";
import { isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./client";
import { SUBSCRIBER_PROPS } from "./schema";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function subscribersDataSourceId(): string {
  return requireEnv("NOTION_SUBSCRIBERS_DB_ID");
}

export interface Subscriber {
  pageId: string;
  email: string;
  unsubscribeToken: string;
}

function parseSubscriber(page: PageObjectResponse): Subscriber {
  const props = page.properties;

  const titleProp = props[SUBSCRIBER_PROPS.title];
  const email = titleProp?.type === "title" ? titleProp.title.map((t) => t.plain_text).join("") : "";

  const tokenProp = props[SUBSCRIBER_PROPS.unsubscribeToken];
  const unsubscribeToken =
    tokenProp?.type === "rich_text" ? tokenProp.rich_text.map((t) => t.plain_text).join("") : "";

  return { pageId: page.id, email, unsubscribeToken };
}

// Notion enforces no uniqueness on title values, so a repeat form
// submission would otherwise create a duplicate row (and a duplicate
// weekly email) — check first.
async function findByEmail(email: string): Promise<Subscriber | null> {
  const res = await notion.dataSources.query({
    data_source_id: subscribersDataSourceId(),
    filter: { property: SUBSCRIBER_PROPS.title, title: { equals: email } },
    page_size: 1,
  });
  const page = res.results.find(isFullPage);
  return page ? parseSubscriber(page) : null;
}

export async function subscribeEmail(email: string): Promise<void> {
  const existing = await findByEmail(email);
  if (existing) return;

  await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: subscribersDataSourceId() },
    properties: {
      [SUBSCRIBER_PROPS.title]: {
        type: "title",
        title: [{ type: "text", text: { content: email } }],
      },
      [SUBSCRIBER_PROPS.subscribedAt]: {
        type: "date",
        date: { start: new Date().toISOString() },
      },
      // Generated once at subscribe time, not per send — the unsubscribe
      // link stays valid across every future digest.
      [SUBSCRIBER_PROPS.unsubscribeToken]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: randomUUID() } }],
      },
    },
  });
}

export async function getAllSubscribers(): Promise<Subscriber[]> {
  const subscribers: Subscriber[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: subscribersDataSourceId(),
      start_cursor: cursor,
      page_size: 100,
    });
    subscribers.push(...res.results.filter(isFullPage).map(parseSubscriber));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return subscribers;
}

// Archiving (soft delete) instead of a "구독중" checkbox keeps
// getAllSubscribers() simple — an archived page never comes back from
// dataSources.query() at all, so there's no risk of a stale "구독 취소함"
// row accidentally being included in a future send.
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const res = await notion.dataSources.query({
    data_source_id: subscribersDataSourceId(),
    filter: { property: SUBSCRIBER_PROPS.unsubscribeToken, rich_text: { equals: token } },
    page_size: 1,
  });
  const page = res.results.find(isFullPage);
  if (!page) return false;

  await notion.pages.update({ page_id: page.id, archived: true });
  return true;
}
