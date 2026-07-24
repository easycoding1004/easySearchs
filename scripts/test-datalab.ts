import { config } from "dotenv";
config({ path: ".env.local" });

import { postDatalab } from "../src/lib/naver/datalabClient";

// Empirically probes candidate DataLab Shopping Insight endpoints/payload
// shapes against the real API (official docs aren't reachable from this
// environment) and prints what each one actually returns, so the real
// client can be locked in against confirmed-working shapes.

const START_DATE = "2026-05-01";
const END_DATE = "2026-07-01";
const CATEGORY_NAME = "패션의류";
const CATEGORY_CID = "50000000";

async function tryCall(label: string, path: string, body: Record<string, unknown>) {
  console.log(`\n=== ${label} ===`);
  console.log("POST", path, JSON.stringify(body));
  try {
    const data = await postDatalab(path, body);
    console.log("OK:", JSON.stringify(data, null, 2).slice(0, 800));
  } catch (err) {
    console.log("FAILED:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  await tryCall("categories (category trend)", "/categories", {
    startDate: START_DATE,
    endDate: END_DATE,
    timeUnit: "month",
    category: [{ name: CATEGORY_NAME, param: [CATEGORY_CID] }],
    device: "",
    gender: "",
    ages: [],
  });

  await tryCall("category/keywords (keyword trend)", "/category/keywords", {
    startDate: START_DATE,
    endDate: END_DATE,
    timeUnit: "month",
    category: CATEGORY_CID,
    keyword: [{ name: "청바지", param: ["청바지"] }],
    device: "",
    gender: "",
    ages: [],
  });

  await tryCall("category/device (category-level device breakdown)", "/category/device", {
    startDate: START_DATE,
    endDate: END_DATE,
    timeUnit: "month",
    category: CATEGORY_CID,
    device: "pc",
  });

  await tryCall("category/gender (category-level gender breakdown)", "/category/gender", {
    startDate: START_DATE,
    endDate: END_DATE,
    timeUnit: "month",
    category: CATEGORY_CID,
    gender: "f",
  });

  await tryCall("category/age (category-level age breakdown)", "/category/age", {
    startDate: START_DATE,
    endDate: END_DATE,
    timeUnit: "month",
    category: CATEGORY_CID,
    ages: ["20", "30"],
  });

  await tryCall(
    "category/keyword/device (keyword-level device breakdown)",
    "/category/keyword/device",
    {
      startDate: START_DATE,
      endDate: END_DATE,
      timeUnit: "month",
      category: CATEGORY_CID,
      keyword: "청바지",
      device: "mo",
    }
  );

  await tryCall(
    "category/keyword/gender (keyword-level gender breakdown)",
    "/category/keyword/gender",
    {
      startDate: START_DATE,
      endDate: END_DATE,
      timeUnit: "month",
      category: CATEGORY_CID,
      keyword: "청바지",
      gender: "f",
    }
  );

  await tryCall(
    "category/keyword/age (keyword-level age breakdown)",
    "/category/keyword/age",
    {
      startDate: START_DATE,
      endDate: END_DATE,
      timeUnit: "month",
      category: CATEGORY_CID,
      keyword: "청바지",
      ages: ["20", "30"],
    }
  );
}

main().catch((err) => {
  console.error("test-datalab failed:", err);
  process.exit(1);
});
