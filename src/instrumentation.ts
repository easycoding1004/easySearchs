import { SNAPSHOT_JOB_INTERVAL_MS } from "./lib/constants";

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
}
