import {
  SNAPSHOT_JOB_INTERVAL_MS,
  NEWSLETTER_JOB_INTERVAL_MS,
  BILLING_JOB_INTERVAL_MS,
  POLICY_BOARD_JOB_INTERVAL_MS,
} from "./lib/constants";

// Next.js가 서버 프로세스 시작 시 정확히 1회 호출하는 공식 훅. 이 프로젝트
// 최초의 "상시 백그라운드 잡" — 기존 TTL 캐시들은 요청이 있을 때만 채워지는
// 지연 방식이었지만, 이건 트래픽과 무관하게 주기적으로 실행된다. 상주형
// 서버(Railway)를 전제로 함 — 서버리스로 옮기면 Railway Cron 등 외부
// 스케줄러로 교체해야 한다 (CLAUDE.md §11 참고).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Next dev 모드의 중복 초기화를 포함해, register()가 여러 번 불려도
  // setInterval이 중복 등록되지 않도록 프로세스 전역 플래그로 방지.
  const g = globalThis as typeof globalThis & { __snapshotJobStarted?: boolean };
  if (g.__snapshotJobStarted) return;
  g.__snapshotJobStarted = true;

  const { runSnapshotJob } = await import("./lib/scheduler/snapshotJob");

  runSnapshotJob().catch((err) => {
    console.error("[instrumentation] initial snapshot job failed:", err);
  });

  setInterval(() => {
    runSnapshotJob().catch((err) => {
      console.error("[instrumentation] scheduled snapshot job failed:", err);
    });
  }, SNAPSHOT_JOB_INTERVAL_MS);

  // 스냅샷 잡과 달리 시작 시 즉시 실행하지 않음 — 매 배포마다 구독자에게
  // 이메일이 나가면 안 되므로, 주기(7일)가 실제로 다 찼을 때만 발송한다.
  const { runNewsletterJob } = await import("./lib/scheduler/newsletterJob");
  setInterval(() => {
    runNewsletterJob().catch((err) => {
      console.error("[instrumentation] scheduled newsletter job failed:", err);
    });
  }, NEWSLETTER_JOB_INTERVAL_MS);

  // 토스페이먼츠 월 구독제 정기 청구 — newsletterJob과 같은 이유로 시작 시
  // 즉시 실행하지 않음(매 배포마다 카드가 청구되면 안 되므로).
  const { runBillingJob } = await import("./lib/scheduler/billingJob");
  setInterval(() => {
    runBillingJob().catch((err) => {
      console.error("[instrumentation] scheduled billing job failed:", err);
    });
  }, BILLING_JOB_INTERVAL_MS);

  // 소상공인 정책정보 게시판 — snapshotJob과 같은 이유로 시작 시 즉시 1회
  // 실행(돈이 나가는 잡이 아니라 콘텐츠가 빨리 채워지는 것뿐이라 안전함).
  const { runPolicyBoardJob } = await import("./lib/scheduler/policyBoardJob");
  runPolicyBoardJob().catch((err) => {
    console.error("[instrumentation] initial policy board job failed:", err);
  });
  setInterval(() => {
    runPolicyBoardJob().catch((err) => {
      console.error("[instrumentation] scheduled policy board job failed:", err);
    });
  }, POLICY_BOARD_JOB_INTERVAL_MS);
}
