import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchKeywordStats } from "../src/lib/naver/client";

async function main() {
  const keyword = process.argv[2] ?? "특성화고";
  console.log(`Fetching Naver keyword stats for "${keyword}"...`);

  const rows = await fetchKeywordStats(keyword);
  console.log(`Received ${rows.length} rows.`);
  console.table(rows.slice(0, 10));
}

main().catch((err) => {
  console.error("Naver API call failed:", err);
  process.exit(1);
});
