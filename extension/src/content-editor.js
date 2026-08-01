// content script는 정적 import를 못 씀(매니페스트가 content_scripts에
// type:"module"을 지원 안 함, background.js와 다름) — config.js와 값을
// 반드시 같이 맞출 것.
const API_BASE_URL = "https://ezzsearch.com";

// ⚠️ 미검증 코드 — 네이버 블로그 에디터(SmartEditor)의 실제 라이브 DOM을
// 이 환경에서는 확인할 방법이 없어서(로그인 세션이 필요한 JS 렌더링 화면이라
// 정적 fetch로는 못 봄), 아래 선택자들은 공개적으로 알려진 관례를 참고한
// 추정치임. §CLAUDE.md 17.4 참고 — 실제 Chrome에서 에디터를 열어 개발자
// 도구로 진짜 선택자를 확인한 뒤 이 객체만 고치면 나머지 로직은 그대로
// 재사용 가능하도록 구조를 분리해뒀음.
const SELECTORS = {
  // 후보를 순서대로 시도 — 첫 번째로 매치되는 요소를 씀.
  title: ['.se-title-text[contenteditable="true"]', 'textarea[name="documentTitle"]', "#subject"],
  body: [".se-main-container .se-text[contenteditable='true']", ".se-component-content [contenteditable='true']"],
  tagInput: ['input[placeholder*="태그"]', "#tag-input", ".tag_input"],
};

const DRAFT_KEY = "pendingDraft";
const DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2시간 지난 초안은 안 띄움(엉뚱한 글에 옛날 초안이 뜨는 걸 방지)
const TAG_LOOKUP_DEBOUNCE_MS = 500;

function findFirst(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "72px",
    right: "20px",
    zIndex: "2147483647",
    background: isError ? "#c0392b" : "#3d2e1f",
    color: "white",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    maxWidth: "280px",
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 합성 paste 이벤트로 붙여넣기를 시도함 — 실제 사람이 Ctrl+V 했을 때와
// 달리 event.isTrusted가 false라서, 페이지가 자체 JS로 clipboardData를 읽어
// 처리하는 에디터(SmartEditor처럼 커스텀 서식 붙여넣기를 지원하는 에디터는
// 보통 이렇게 구현됨)에서는 동작하지만 브라우저 기본 붙여넣기 동작에만
// 의존하는 필드에서는 안 먹을 수 있음 — 그래서 실제 클립보드에도 항상 같이
// 써서(navigator.clipboard.write), 자동 삽입이 안 먹으면 사용자가 바로
// Ctrl+V로 수동 붙여넣기할 수 있게 이중 안전장치를 둠.
function simulatePaste(target, html, text) {
  if (!target) return false;
  target.focus();
  try {
    const dt = new DataTransfer();
    dt.setData("text/html", html);
    dt.setData("text/plain", text);
    const event = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return true;
  } catch (err) {
    console.warn("[ezzsearch] simulatePaste failed:", err);
    return false;
  }
}

async function copyToRealClipboard(html, text) {
  try {
    if (typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) }),
      ]);
    } else {
      await navigator.clipboard.writeText(text);
    }
  } catch (err) {
    console.warn("[ezzsearch] clipboard write failed:", err);
  }
}

function stripHtmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}

async function insertDraft(draft) {
  const titleEl = findFirst(SELECTORS.title);
  const bodyEl = findFirst(SELECTORS.body);

  if (!titleEl && !bodyEl) {
    showToast(
      "에디터 입력창을 찾지 못했어요 — 클립보드에는 복사해뒀으니 Ctrl+V로 직접 붙여넣어 주세요.",
      true
    );
    await copyToRealClipboard(draft.html, `${draft.title}\n\n${stripHtmlToText(draft.html)}`);
    return;
  }

  if (titleEl) {
    if ("value" in titleEl) {
      titleEl.value = draft.title;
      titleEl.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      simulatePaste(titleEl, draft.title, draft.title);
    }
  }
  if (bodyEl) {
    simulatePaste(bodyEl, draft.html, stripHtmlToText(draft.html));
  }
  await copyToRealClipboard(draft.html, `${draft.title}\n\n${stripHtmlToText(draft.html)}`);

  showToast(
    "제목·본문을 넣어봤어요 — 반영이 안 됐다면 Ctrl+V로 직접 붙여넣어 주세요(클립보드에도 복사해뒀어요). 사진은 직접 업로드해주세요."
  );
  chrome.storage.local.remove(DRAFT_KEY);
  removeInsertButton();
}

let insertButtonEl = null;

function removeInsertButton() {
  insertButtonEl?.remove();
  insertButtonEl = null;
}

function showInsertButton(draft) {
  removeInsertButton();
  const btn = document.createElement("button");
  btn.textContent = "이지서치 초안 붙여넣기";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483647",
    background: "#e06b3d",
    color: "white",
    border: "none",
    borderRadius: "999px",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
  });
  btn.addEventListener("click", () => insertDraft(draft));
  document.body.appendChild(btn);
  insertButtonEl = btn;
}

async function checkPendingDraft() {
  const store = await chrome.storage.local.get(DRAFT_KEY);
  const draft = store[DRAFT_KEY];
  if (!draft) return;
  if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
    chrome.storage.local.remove(DRAFT_KEY);
    return;
  }
  showInsertButton(draft);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[DRAFT_KEY]) return;
  if (changes[DRAFT_KEY].newValue) showInsertButton(changes[DRAFT_KEY].newValue);
  else removeInsertButton();
});

checkPendingDraft();

// --- 태그 입력창 옆 검색량 배지(원본 아이디어 ①의 "에디터에서 태그 입력 시
// 검색량 표시" 부분만 우선 구현 — 검색결과 페이지 오버레이는 이번 범위 밖,
// §CLAUDE.md 17.4 참고) ---
let tagBadgeEl = null;
let tagDebounceTimer = null;

function ensureTagBadge(anchor) {
  if (tagBadgeEl && document.body.contains(tagBadgeEl)) return tagBadgeEl;
  tagBadgeEl = document.createElement("span");
  Object.assign(tagBadgeEl.style, {
    position: "absolute",
    zIndex: "2147483647",
    background: "#fffbf7",
    border: "1px solid #ede6dd",
    borderRadius: "6px",
    padding: "3px 8px",
    fontSize: "12px",
    color: "#3d2e1f",
    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
  });
  document.body.appendChild(tagBadgeEl);
  positionBadgeNear(anchor);
  return tagBadgeEl;
}

function positionBadgeNear(el) {
  if (!tagBadgeEl) return;
  const rect = el.getBoundingClientRect();
  tagBadgeEl.style.top = `${window.scrollY + rect.bottom + 4}px`;
  tagBadgeEl.style.left = `${window.scrollX + rect.left}px`;
}

async function showTagVolume(el) {
  const keyword = el.value.trim();
  if (!keyword) {
    tagBadgeEl?.remove();
    tagBadgeEl = null;
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/extension/keyword-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    const data = await res.json();
    if (!res.ok) return;
    const badge = ensureTagBadge(el);
    const total = data.monthlyPcQcCnt + data.monthlyMobileQcCnt;
    badge.textContent = `월 검색량 ${total.toLocaleString("ko-KR")}`;
    positionBadgeNear(el);
  } catch {
    // Silent — this is a nice-to-have overlay, not critical.
  }
}

function attachTagListener() {
  const el = findFirst(SELECTORS.tagInput);
  if (!el || el.dataset.ezzsearchAttached) return;
  el.dataset.ezzsearchAttached = "true";
  el.addEventListener("input", () => {
    clearTimeout(tagDebounceTimer);
    tagDebounceTimer = setTimeout(() => showTagVolume(el), TAG_LOOKUP_DEBOUNCE_MS);
  });
}

// 에디터가 SPA라 태그 입력창이 나중에 DOM에 붙을 수 있어서, 주기적으로
// 리스너를 재시도함(무겁지 않게 3초 간격) — MutationObserver가 더 정확하지만
// 에디터 내부 구조를 모르는 상태에서 관찰 대상을 좁히기 어려워 MVP는 폴링으로.
setInterval(attachTagListener, 3000);
attachTagListener();
