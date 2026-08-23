import { fetchBizinfoAnnouncements } from "../policyBoard/bizinfoClient";
import { findPolicyPostBySourceId, createPolicyPost } from "../notion/policyBoard";
import { POLICY_BOARD_JOB_CONCURRENCY } from "../constants";
import { mapWithConcurrency } from "../utils/concurrency";

// 기업마당 공고를 매일 훑어 아직 게시하지 않은 것만 자동 등록 —
// BIZINFO_API_KEY가 없으면 fetchBizinfoAnnouncements가 빈 배열을 조용히
// 반환하므로 이 잡 자체는 안전하게 무동작.
export async function runPolicyBoardJob(): Promise<void> {
  let announcements: Awaited<ReturnType<typeof fetchBizinfoAnnouncements>> = [];
  try {
    announcements = await fetchBizinfoAnnouncements();
  } catch (err) {
    console.error("[policyBoardJob] bizinfo fetch failed:", err);
    return;
  }

  if (announcements.length === 0) {
    console.log("[policyBoardJob] no announcements (missing API key or empty response)");
    return;
  }

  console.log(`[policyBoardJob] checking ${announcements.length} announcement(s)`);

  let createdCount = 0;
  await mapWithConcurrency(announcements, POLICY_BOARD_JOB_CONCURRENCY, async (item) => {
    try {
      const alreadyPosted = await findPolicyPostBySourceId(item.sourceId);
      if (alreadyPosted) return;

      await createPolicyPost({
        title: item.title,
        body: item.description,
        category: item.category,
        sourceUrl: item.link,
        organization: item.organization,
        deadline: item.deadline,
        sourceId: item.sourceId,
      });
      createdCount++;
    } catch (err) {
      console.error(`[policyBoardJob] failed to process "${item.title}":`, err);
    }
  });

  console.log(`[policyBoardJob] done (${createdCount} new post(s) created)`);
}
