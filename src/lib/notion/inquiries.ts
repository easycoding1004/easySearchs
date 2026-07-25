import { notion } from "./client";
import { INQUIRY_PROPS } from "./schema";
import { countRowsMatching } from "./queryHelpers";
import { kstDayRangeUtcIso } from "../utils/formatDate";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function inquiriesDataSourceId(): string {
  return requireEnv("NOTION_INQUIRIES_DB_ID");
}

export async function createInquiry(input: {
  name: string;
  email: string;
  message: string;
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: inquiriesDataSourceId() },
    properties: {
      [INQUIRY_PROPS.title]: {
        type: "title",
        title: [{ type: "text", text: { content: `${input.name} - ${input.email}` } }],
      },
      [INQUIRY_PROPS.name]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.name } }],
      },
      [INQUIRY_PROPS.email]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.email } }],
      },
      [INQUIRY_PROPS.message]: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: input.message.slice(0, 1900) } }],
      },
      [INQUIRY_PROPS.handled]: { type: "checkbox", checkbox: false },
    },
  });
  return page.id;
}

// 이메일 발송 자체는 Resend가 처리하고 이건 Notion 백업 기록 기준 카운트라,
// 이메일은 성공했는데 Notion 저장만 실패한 경우(§12.3) 실제보다 적게 잡힐 수
// 있음 — 화면에 그 각주를 함께 표시할 것.
export async function countInquiriesToday(): Promise<number> {
  const { startIso, endIso } = kstDayRangeUtcIso(0);
  return countRowsMatching(inquiriesDataSourceId(), {
    timestamp: "created_time",
    created_time: { on_or_after: startIso, before: endIso },
  });
}
