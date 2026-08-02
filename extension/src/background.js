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
// 차원에서 입력이 주입되어 페이지 입장에서는 실제 사용자 입력과 구분이 안 됨.
// **한 번 시도했다가 "브라우저가 꺼진다"는 신고로 되돌렸었는데, 재조사 결과
// 진짜 원인은 이게 아니라 BlogWriterForm.tsx가 ACK 타임아웃 시 자동으로 연
// 탭을 직접 닫아버리던 별개의 버그였음(그 버그는 고쳤음) — 그래서 이 CDP
// 방식을 다시 시도함.** 대가로 (1) 더 민감한 `debugger` 권한이 필요하고
// (크롬 웹스토어 심사가 더 까다로워짐), (2) 사용하는 동안 브라우저 상단에
// "이 확장이 페이지를 디버깅하고 있습니다" 배너가 뜸 — 사용자와 논의 후
// 감수하기로 함. content script는 DOM 접근은 되지만 chrome.debugger를 못
// 쓰고, 여기(background, 유일하게 chrome.debugger를 쓸 수 있는 곳)는 DOM에
// 접근 못 하므로 역할을 나눔: content-editor.js가 대상 요소에 focus()를
// 먼저 건 다음 이 함수를 호출하면, CDP가 "현재 포커스된 곳"에 텍스트를 넣음.
// 호출마다 attach→삽입→detach를 하므로 배너가 짧게 깜빡이지만(제목 1번,
// 본문 1번) 상태를 프레임 간에 공유할 필요가 없어 훨씬 단순함. DevTools가
// 이미 열려 있는 탭이면 attach가 실패함(크롬이 동시 디버깅 세션을 허용 안
// 함) — 그 경우 content-editor.js가 기존 execCommand/simulatePaste로 폴백함.
function sendDebuggerCommand(debuggee, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(debuggee, method, params, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

// attach→fn(debuggee)→detach를 묶어주는 헬퍼 — cdpInsertText/cdpInsertTags가
// 공유. fn 안에서 실패하면(reject) ok:false로 변환하고, 성공하면 fn의 반환값을
// 그대로 통과시킴(현재는 둘 다 { ok: true }만 반환하지만 확장 여지를 둠).
//
// 2026-08 사용자 신고("이번엔 또 자동 삽입이 안 됨", 태그 기능 추가 직후) —
// detach()를 콜백 완료를 기다리지 않고 fire-and-forget으로 호출하고
// 있었음(finally 블록이 await 없이 바로 반환). 제목→본문 2번뿐일 때는
// 우연히 안 부딪혔을 수 있는데, 태그가 추가되며 attach/detach가 3번(제목,
// 본문, 태그)으로 늘면서 이전 detach가 채 끝나기 전에 다음 attach가
// 시작되는 경쟁이 더 자주 발생했을 가능성이 높음 — detach도 완료될 때까지
// 기다리도록 고침(성공이든 실패든 detach 완료 후에만 반환).
async function withDebugger(tabId, fn) {
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

  let result;
  try {
    result = await fn(debuggee);
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  await new Promise((resolve) => {
    chrome.debugger.detach(debuggee, () => {
      void chrome.runtime.lastError; // 이미 detach된 상태 등은 무시 — 다음 attach를 막을 필요 없음
      resolve();
    });
  });
  return result;
}

async function cdpInsertText(tabId, text) {
  return withDebugger(tabId, async (debuggee) => {
    await sendDebuggerCommand(debuggee, "Input.insertText", { text });
    return { ok: true };
  });
}

// 2026-08 — CDP Input.insertText 자체는 정상 동작하는데도(브라우저 엔진
// 차원의 신뢰된 입력) 제목·본문에 매번 아무 변화가 없는 게 사후 검증
// (content-editor.js의 insertViaDebugger `landed` 비교)으로 확인됨. 지금까지
// SmartEditor에게 "이 필드가 활성"이라고 알려주려고 쓴 `target.focus()`/
// `target.click()`은 전부 페이지 스크립트가 만든 이벤트라 `isTrusted:false` —
// 이 세션 내내 "isTrusted가 아닌 건 SmartEditor가 무시한다"는 패턴이 계속
// 반복됐는데(paste 이벤트, execCommand 모두 이 이유로 실패), 필드를 전환하는
// 클릭 자체도 같은 이유로 무시되고 있었을 가능성이 높음 — 그래서 텍스트
// 삽입뿐 아니라 "필드를 활성화하는 클릭"도 CDP(Input.dispatchMouseEvent, 실제
// 하드웨어 입력과 같은 신뢰 등급)로 보내도록 함. content-editor.js가 대상
// 요소의 화면 좌표(중첩 iframe 오프셋까지 합산한 최상위 페이지 기준 절대
// 좌표)를 계산해서 넘겨준다.
async function cdpClick(tabId, x, y) {
  return withDebugger(tabId, async (debuggee) => {
    await sendDebuggerCommand(debuggee, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    });
    await sendDebuggerCommand(debuggee, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
    });
    return { ok: true };
  });
}

// 2026-08(사용자 요청 — "태그도 자동으로 삽입이 어려운가") — 네이버 태그
// 입력창은 붙여넣은 텍스트 뭉치에서는 쉼표를 "구분자"가 아니라 "글자"로
// 인식해서 여러 태그가 하나로 뭉쳐버리는 것으로 실측 확인됨(§CLAUDE.md 16) —
// 그 입력창이 Enter/쉼표 "키 입력 이벤트"로만 태그를 분리하기 때문. CDP는
// 텍스트 삽입뿐 아니라 `Input.dispatchKeyEvent`로 실제 키보드 입력과 구분 안
// 되는 키 이벤트도 보낼 수 있어서, 태그마다 `Input.insertText`로 글자를 넣고
// 바로 Enter 키다운·키업을 보내 하나씩 확정시킴 — 여러 태그를 한 번의
// attach/detach 세션 안에서 순서대로 처리(태그마다 배너가 깜빡이면 번거로우니
// 세션 하나로 묶음).
async function cdpInsertTags(tabId, tags) {
  return withDebugger(tabId, async (debuggee) => {
    for (const tag of tags) {
      await sendDebuggerCommand(debuggee, "Input.insertText", { text: tag });
      for (const type of ["keyDown", "keyUp"]) {
        await sendDebuggerCommand(debuggee, "Input.dispatchKeyEvent", {
          type,
          windowsVirtualKeyCode: 13,
          key: "Enter",
          code: "Enter",
        });
      }
    }
    return { ok: true };
  });
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
  if (message?.type === "CDP_INSERT_TAGS") {
    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse({ ok: false, error: "tabId 없음" });
      return false;
    }
    cdpInsertTags(tabId, Array.isArray(message.tags) ? message.tags : []).then(sendResponse);
    return true; // sendResponse가 비동기로 불릴 것임을 알림
  }
  if (message?.type === "CDP_CLICK") {
    const tabId = sender.tab?.id;
    if (tabId == null || typeof message.x !== "number" || typeof message.y !== "number") {
      sendResponse({ ok: false, error: "tabId 또는 좌표 없음" });
      return false;
    }
    cdpClick(tabId, message.x, message.y).then(sendResponse);
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
