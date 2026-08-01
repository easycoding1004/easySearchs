import { API_BASE_URL } from "./config.js";

const CONTEXT_MENU_ID = "ezzsearch-lookup";
const RECENT_KEY = "recentSearches";
const DRAFT_KEY = "pendingDraft"; // 2026-08: /write에서 넘겨받은 초안(제목/HTML/태그)
const MAX_RECENT = 20;
const NOTIFICATION_URL_MAP = {}; // notificationId -> url, for onClicked routing

// content-write-bridge.js가 중계하는 초안 저장 — 네이버 에디터 탭의
// content-editor.js가 storage.onChanged로 이 값을 감지해서 "붙여넣기" 버튼을
// 띄움. savedAt을 같이 저장해서, 너무 오래된 초안(예: 며칠 전 것)이 뜬금없이
// 다시 뜨는 걸 에디터 쪽에서 걸러낼 수 있게 함.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "STORE_DRAFT") return;
  chrome.storage.local.set(
    { [DRAFT_KEY]: { ...message.payload, savedAt: Date.now() } },
    () => sendResponse({ ok: true })
  );
  return true; // sendResponse가 비동기로 불릴 것임을 알림
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: '이지서치로 "%s" 검색량 조회',
    contexts: ["selection"],
  });
});

async function fetchKeywordVolume(keyword) {
  const res = await fetch(`${API_BASE_URL}/api/extension/keyword-lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function formatCount(value) {
  return value.toLocaleString("ko-KR");
}

async function pushRecent(result) {
  const store = await chrome.storage.local.get(RECENT_KEY);
  const list = store[RECENT_KEY] || [];
  const filtered = list.filter((item) => item.keyword !== result.keyword);
  filtered.unshift({
    keyword: result.keyword,
    monthlyPcQcCnt: result.monthlyPcQcCnt,
    monthlyMobileQcCnt: result.monthlyMobileQcCnt,
    checkedAt: Date.now(),
  });
  await chrome.storage.local.set({ [RECENT_KEY]: filtered.slice(0, MAX_RECENT) });
}

// 우클릭·주소창 흐름이 공유하는 조회 함수 — 성공하면 데스크톱 알림으로
// 검색량을 바로 보여주고(사이트 왕복 없음), "최근 검색" 목록에 남겨서 팝업
// 에서 다시 볼 수 있게 함. 알림을 클릭하면 사이트로 이동해 연관 키워드 등
// 더 자세한 내용을 볼 수 있음.
async function lookupAndNotify(keyword) {
  const notificationId = `ez-${Date.now()}`;
  try {
    const result = await fetchKeywordVolume(keyword);
    const total = result.monthlyPcQcCnt + result.monthlyMobileQcCnt;
    NOTIFICATION_URL_MAP[notificationId] = API_BASE_URL;
    chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: `"${result.keyword}" 월간 검색량`,
      message: `PC ${formatCount(result.monthlyPcQcCnt)} · 모바일 ${formatCount(result.monthlyMobileQcCnt)} · 합계 ${formatCount(total)}`,
      contextMessage: "클릭하면 이지서치에서 연관 키워드까지 볼 수 있어요.",
    });
    await pushRecent(result);
  } catch (err) {
    chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "조회 실패",
      message: err instanceof Error ? err.message : "잠시 후 다시 시도해 주세요.",
    });
  }
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  const selection = (info.selectionText || "").trim();
  if (!selection) return;
  lookupAndNotify(selection);
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const url = NOTIFICATION_URL_MAP[notificationId];
  if (url) chrome.tabs.create({ url });
  delete NOTIFICATION_URL_MAP[notificationId];
  chrome.notifications.clear(notificationId);
});

// 주소창에 "ez " 입력 시 뜨는 기본 안내 문구 — 실제 자동완성 후보(연관
// 키워드 목록 등)까지 보여주려면 매 타이핑마다 API를 호출해야 해서 비용이
// 크므로, MVP에서는 입력을 그대로 받아 Enter 시에만 조회함.
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  suggest([
    {
      content: text,
      description: `이지서치로 "${text}" 검색량 조회`,
    },
  ]);
});
chrome.omnibox.setDefaultSuggestion({
  description: "키워드를 입력하고 Enter — 이지서치에서 검색량을 바로 조회해요.",
});

chrome.omnibox.onInputEntered.addListener((text) => {
  const keyword = text.trim();
  if (!keyword) return;
  lookupAndNotify(keyword);
});
