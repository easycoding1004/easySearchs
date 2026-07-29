import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@notionhq/client";
import { USER_PROPS, AUTH_PROVIDER } from "../src/lib/notion/schema";

const notionToken = process.env.NOTION_TOKEN;
const usersDataSourceId = process.env.NOTION_USERS_DB_ID;

if (!notionToken || !usersDataSourceId) {
  console.error("Missing NOTION_TOKEN or NOTION_USERS_DB_ID in .env.local.");
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// One-off migration: adds 가입방식/소셜ID to the existing 사용자 계정
// database for 네이버/카카오 social login. Additive only — existing rows
// and properties untouched.
async function main() {
  console.log("Adding 가입방식/소셜ID properties to 사용자 계정...");
  await notion.dataSources.update({
    data_source_id: usersDataSourceId!,
    properties: {
      [USER_PROPS.authProvider]: {
        type: "select",
        select: {
          options: [
            { name: AUTH_PROVIDER.email },
            { name: AUTH_PROVIDER.naver },
            { name: AUTH_PROVIDER.kakao },
          ],
        },
      },
      [USER_PROPS.providerId]: { type: "rich_text", rich_text: {} },
    },
  });
  console.log("Done.");
}

main().catch((err) => {
  console.error("Failed to add social login properties:", err);
  process.exit(1);
});
