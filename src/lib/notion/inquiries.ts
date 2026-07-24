import { notion } from "./client";
import { INQUIRY_PROPS } from "./schema";

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
