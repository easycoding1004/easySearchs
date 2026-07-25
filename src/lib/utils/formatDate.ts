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
