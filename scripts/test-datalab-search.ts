import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchSearchTrend } from "../src/lib/naver/datalabSearchClient";

// Confirms the real DataLab 검색어트렌드 API is enabled for this app's Open
// API credentials and that the response shape matches the docs, before any
// UI is built against it.

async function main() {
  const today = new Date();
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  console.log("Requesting 1-month daily trend for 크리스마스케이크 ...");
  const result = await fetchSearchTrend(
    [{ groupName: "크리스마스케이크", keywords: ["크리스마스케이크"] }],
    fmt(oneMonthAgo),
    fmt(today),
    "date"
  );

  console.log(JSON.stringify(result, null, 2).slice(0, 1500));
  console.log(`\nresults[0].data.length = ${result.results[0]?.data.length}`);
}

main().catch((err) => {
  console.error("test-datalab-search failed:", err);
  process.exit(1);
});
