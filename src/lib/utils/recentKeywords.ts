// 로그인 없는 구조라 서버에 남기지 않고, 브라우저 localStorage에만 최근
// 조회 키워드를 저장 — 재방문 시 빠르게 다시 찾아볼 수 있게 하는 순수
// 클라이언트 편의 기능.
const STORAGE_KEY = "ezzsearch_recent_keywords";
const MAX_RECENT = 5;

// useSyncExternalStore로 소비되므로, localStorage 내용이 바뀌지 않았다면
// 항상 같은 배열 참조를 반환해야 한다 — 매번 새 배열을 만들면 리렌더가
// 무한히 반복될 수 있음.
let cachedRaw: string | null = null;
let cachedResult: string[] = [];

export function getRecentKeywordsSnapshot(): string[] {
  if (typeof window === "undefined") return cachedResult;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedResult;

  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedResult = Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    cachedResult = [];
  }
  return cachedResult;
}

export function getRecentKeywordsServerSnapshot(): string[] {
  return [];
}

// 콤마로 구분된 다중 키워드 입력을 개별 키워드로 쪼개 각각 최근 목록에 반영.
export function addRecentKeywords(rawInput: string): void {
  if (typeof window === "undefined") return;
  const newKeywords = rawInput
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (newKeywords.length === 0) return;

  const existing = getRecentKeywordsSnapshot();
  const merged = [...newKeywords, ...existing.filter((k) => !newKeywords.includes(k))];
  const capped = merged.slice(0, MAX_RECENT);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // 프라이빗 모드 등으로 localStorage 접근이 막혀 있으면 조용히 무시.
  }
}
