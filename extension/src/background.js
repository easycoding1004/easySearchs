import { API_BASE_URL } from "./config.js";

const CONTEXT_MENU_ID = "ezzsearch-lookup";
const RECENT_KEY = "recentSearches";
const DRAFT_KEY = "pendingDraft"; // 2026-08: /write에서 넘겨받은 초안(제목/HTML/태그/이미지)
const MAX_RECENT = 20;
const NOTIFICATION_URL_MAP = {}; // notificationId -> url, for onClicked routing

// 2026-08: 네이버 블로그 이미지 업로드 URL을 실측으로 확인해보니(§CLAUDE.md
// 17.5), 고정된 공개 API가 아니라 글쓰기 세션을 열 때마다 새로 발급되는
// 서명된 주소였음(userId·타임스탬프·에디터종류·해시로 구성) — 그래서 이걸
// 처음부터 만들어낼 수 없고, 탭에서 실제로 한 번 발생한 업로드 요청을
// "관찰"해서 재사용하는 방식으로 감(webRequest는 읽기 전용 관찰이라 요청 자체를
// 막거나 바꾸지 않음). 세션 전체(사용자·에디터 단위)에 재사용 가능해 보여서
// 탭 하나당 하나만 캐싱해두고 이후 이미지들은 이 URL로 바로 업로드함 —
// 사용자가 최소 1장은 직접 업로드해야 이 URL을 볼 수 있다는 게 알려진 제약.
const UPLOAD_URL_TTL_MS = 2 * 60 * 60 * 1000; // 2시간 — 너무 오래된 세션 URL은 만료됐을 수 있어 버림
const uploadUrlByTab = new Map(); // tabId -> { url, capturedAt }

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    uploadUrlByTab.set(details.tabId, { url: details.url, capturedAt: Date.now() });
  },
  { urls: ["https://blog.upphoto.naver.com/*/simpleUpload/*"] }
);

chrome.tabs.onRemoved.addListener((tabId) => uploadUrlByTab.delete(tabId));

// 2026-08(사용자 요청 — "복사 붙여넣기가 아니라 진짜 자동으로 처리했으면") —
// SmartEditor는 스크립트가 만드는 paste 이벤트/execCommand 둘 다 무시하고
// 사람이 직접 누른 Ctrl+V만 받아들이는 것으로 실측 확인됨(§CLAUDE.md 17.4).
// 브라우저는 `document.dispatchEvent`로 만든 이벤트에 항상 `isTrusted: false`를
// 강제해서 페이지 스크립트로는 이걸 절대 못 바꾸는데, chrome.debugger API로
// Chrome DevTools Protocol(CDP)의 `Input.insertText`를 쓰면 브라우저 엔진
// 차원에서 입력이 주입되어 페이지 입장에서는 실제 사용자 입력과 구분이 안 됨
// — 이게 지금까지 시도한 방법과 근본적으로 다른 유일한 방법. 대가로 (1) 더
// 민감한 `debugger` 권한이 필요하고(크롬 웹스토어 심사가 더 까다로워짐),
// (2) 사용하는 동안 브라우저 상단에 "이 확장이 페이지를 디버깅하고
// 있습니다" 배너가 뜸 — 사용자와 논의 후 감수하기로 함. content script는
// DOM 접근은 되지만 chrome.debugger를 못 쓰고, 여기(background, 유일하게
// chrome.debugger를 쓸 수 있는 곳)는 DOM에 접근 못 하므로 역할을 나눔:
// content-editor.js가 대상 요소에 focus()를 먼저 건 다음 이 함수를 호출하면,
// CDP가 "현재 포커스된 곳"에 텍스트를 넣음. 호출마다 attach→삽입→detach를
// 하므로 배너가 짧게 깜빡이지만(제목 1번, 본문 1번) 상태를 프레임 간에
// 공유할 필요가 없어 훨씬 단순함. DevTools가 이미 열려 있는 탭이면 attach가
// 실패함(크롬이 동시 디버깅 세션을 허용 안 함) — 그 경우 content-editor.js가
// 기존 execCommand/simulatePaste로 폴백함.
async function cdpInsertText(tabId, text) {
  const debuggee = { tabId };
  try {
    await new Promise((resolve, reject) => {
      chrome.debugger.attach(debuggee, "1.3", () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  } catch (err) {
    return { ok: false, error: `attach 실패: ${err.message}` };
  }

  try {
    await new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(debuggee, "Input.insertText", { text }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Input.insertText 실패: ${err.message}` };
  } finally {
    chrome.debugger.detach(debuggee, () => void chrome.runtime.lastError);
  }
}

// content-write-bridge.js가 중계하는 초안 저장 — 네이버 에디터 탭의
// content-editor.js가 storage.onChanged로 이 값을 감지해서 "붙여넣기" 버튼을
// 띄움. savedAt을 같이 저장해서, 너무 오래된 초안(예: 며칠 전 것)이 뜬금없이
// 다시 뜨는 걸 에디터 쪽에서 걸러낼 수 있게 함.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "STORE_DRAFT") {
    chrome.storage.local.set(
      { [DRAFT_KEY]: { ...message.payload, savedAt: Date.now() } },
      () => sendResponse({ ok: true })
    );
    return true; // sendResponse가 비동기로 불릴 것임을 알림
  }
  if (message?.type === "GET_UPLOAD_URL") {
    const tabId = sender.tab?.id;
    const entry = tabId != null ? uploadUrlByTab.get(tabId) : null;
    const fresh = entry && Date.now() - entry.capturedAt < UPLOAD_URL_TTL_MS ? entry.url : null;
    sendResponse({ url: fresh });
    return false;
  }
  if (message?.type === "CDP_INSERT_TEXT") {
    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse({ ok: false, error: "tabId 없음" });
      return false;
    }
    cdpInsertText(tabId, message.text || "").then(sendResponse);
    return true; // sendResponse가 비동기로 불릴 것임을 알림
  }
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
