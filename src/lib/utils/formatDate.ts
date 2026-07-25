// 서버가 어느 타임존(Railway 기본값은 UTC)에서 돌든 화면엔 항상 한국 시간으로
// 보이게 함. `toLocaleString("ko-KR")`만 쓰면 locale은 표기 형식(24시간제,
// 오전/오후 등)만 정하고 타임존은 실행 환경 기본값을 따라가서, 서버가 UTC일 때
// "방금 조회했는데 9시간 전"처럼 실제 시각과 어긋나 보이는 문제가 있었다.
export function formatKstDateTime(value: string | number): string {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// KST 기준 날짜 문자열(YYYY-MM-DD, offsetDays만큼 과거) — 날짜 단위로만
// 비교하면 되는 데이터(예: 키워드 검색량 스냅샷, 방문 기록)를 하루 단위로
// 묶을 때 씀.
export function getKstDateString(offsetDays = 0): string {
  const ms = Date.now() + KST_OFFSET_MS - offsetDays * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

// "오늘"(daysAgo=0) 또는 "최근 N일"(daysAgo=N-1)의 KST 기준 하루~N일 범위를
// UTC 인스턴트로 변환 — 검색 세션처럼 날짜+시간 전체를 저장하는 필드를
// Notion 날짜 필터(on_or_after/before)로 거를 때 씀.
export function kstDayRangeUtcIso(daysAgo = 0): { startIso: string; endIso: string } {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const y = nowKst.getUTCFullYear();
  const m = nowKst.getUTCMonth();
  const d = nowKst.getUTCDate();
  const startUtcMs = Date.UTC(y, m, d - daysAgo) - KST_OFFSET_MS;
  const endUtcMs = Date.UTC(y, m, d + 1) - KST_OFFSET_MS;
  return { startIso: new Date(startUtcMs).toISOString(), endIso: new Date(endUtcMs).toISOString() };
}
