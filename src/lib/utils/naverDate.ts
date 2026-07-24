// Naver's blog/cafe search API returns postdate as an 8-digit YYYYMMDD string.
export function parseNaverPostDate(postdate: string): Date | null {
  if (!/^\d{8}$/.test(postdate)) return null;
  const year = Number(postdate.slice(0, 4));
  const month = Number(postdate.slice(4, 6));
  const day = Number(postdate.slice(6, 8));
  return new Date(year, month - 1, day);
}
