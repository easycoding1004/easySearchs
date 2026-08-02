// content script는 정적 import를 못 씀(매니페스트가 content_scripts에
// type:"module"을 지원 안 함, background.js와 다름) — config.js와 값을
// 반드시 같이 맞출 것.
const API_BASE_URL = "https://ezzsearch.com";

// 2026-08 사용자가 실제 브라우저 개발자 도구로 제목·본문·태그 입력창의 실제
// DOM을 캡처해줌 — 셋 다 처음 추정한 선택자와 달랐음.
// - 제목: `<div class="se-module se-module-text ... se-title-text ...">`
//   (se-section-documentTitle 아래, contenteditable 속성은 캡처 범위 밖이라
//   미확인이지만 class 조합 자체는 확실함).
// - 본문: `<div class="se-component se-text se-l-default" data-a11y-title="본문">`
//   — `data-a11y-title="본문"`이 클래스명(빌드마다 안 바뀐다는 보장이 없음)보다
//   훨씬 안정적인 접근성 속성이라 이걸 최우선 후보로 둠.
// - 태그: `<input id="fake-input" class="fake_input__Y86t_" tabindex="-1"
//   aria-hidden="true">`가 `tag_textarea__CD7pC` 안에 있음 — **주의: id는
//   `fake-input`이지만 tabindex=-1·aria-hidden=true라 실제 사용자가 타이핑하는
//   요소가 아니라 내부용 더미 input일 가능성이 있음**(진짜 입력은 옆의
//   `tag_input_wrap__zQUUR` span 안에서 일어날 수도 있는데, 캡처된 스크린샷이
//   그 span의 자식까지는 안 보여줘서 확정 못함). class 뒤 해시(`__Y86t_` 등)는
//   CSS Modules 빌드마다 바뀔 수 있어 접두사만 부분일치(`[class*="fake_input__"]`)
//   시키고, id(`#fake-input`)는 해시가 없어 상대적으로 안정적이라 우선순위를 더 높임
//   — 다만 이 셋 다 "지금 이 순간의 SmartEditor 빌드에서" 확인된 것이라 네이버가
//   마크업을 바꾸면 다시 깨질 수 있음(§CLAUDE.md 17.4 원칙 그대로). 태그 배지가
//   여전히 안 뜨면 이 tagInput 후보부터 재확인할 것.
const SELECTORS = {
  // 후보를 순서대로 시도 — 첫 번째로 매치되는 요소를 씀.
  title: [
    ".se-section-documentTitle .se-module-text.se-title-text",
    ".se-title-text[contenteditable='true']",
    'textarea[name="documentTitle"]',
    "#subject",
  ],
  body: [
    '.se-component.se-text[data-a11y-title="본문"]',
    '[data-a11y-title="본문"]',
    ".se-component.se-text.se-l-default",
    ".se-main-container .se-text[contenteditable='true']",
    ".se-component-content [contenteditable='true']",
  ],
  tagInput: [
    "#fake-input",
    '[class*="fake_input__"]',
    'input[placeholder*="태그"]',
    "#tag-input",
    ".tag_input",
  ],
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

// data:image/...;base64,XXXX → Blob. 확장이 /write에서 받은 사진·AI이미지는
// chrome.storage에 넣으려고 base64 문자열로 와 있어서(파일 객체는 직접
// 저장 못 함), 실제 업로드하려면 바이너리로 되돌려야 함.
function dataUrlToBlob(dataUrl) {
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function getUploadUrl() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_UPLOAD_URL" }, (response) => resolve(response?.url ?? null));
  });
}

// ⚠️ 미검증 코드 — §CLAUDE.md 17.5 참고. 네이버 blog.upphoto.naver.com의
// simpleUpload 엔드포인트는 공식 문서가 없는 비공개 API라, 실제 캡처한
// 요청 하나(multipart/form-data, 필드명 "image")를 그대로 흉내 냄. 응답은
// XML이고 <url> 태그가 CDN 절대경로가 아니라 blogfiles.pstatic.net 기준
// 상대경로만 줌(실측 확인) — 그래서 여기서 도메인을 직접 붙임. ?type=s2 같은
// 쿼리를 안 붙여야 원본 크기로 붙여넣기된다는 것도 실측으로 확인함.
async function uploadImageToNaver(uploadUrl, dataUrl, filename) {
  const blob = dataUrlToBlob(dataUrl);
  const formData = new FormData();
  formData.append("image", blob, filename);
  const res = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`업로드 실패 (HTTP ${res.status})`);
  const xmlText = await res.text();
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const path = doc.querySelector("url")?.textContent;
  if (!path) throw new Error("업로드 응답에서 이미지 경로를 찾지 못함");
  return `https://blogfiles.pstatic.net${path}`;
}

// draft.html에 있는 <img data-ezzsearch-token="사진1"> 같은 플레이스홀더를
// 실제 네이버 CDN 이미지로 채워 넣는다 — 재업로드할 이미지가 있는데 아직 이
// 세션에서 네이버 업로드 URL을 못 봤으면(사용자가 이 에디터에서 사진을 한
// 번도 안 올려봤으면), 그 URL 자체를 모르니 사진 자리는 그대로 두고 텍스트
// 안내만 남김 — 사용자가 사진 1장을 수동으로 올리고 나면 다음 시도부터는
// 자동으로 됨(§CLAUDE.md 17.5의 "세션당 1회 수동 업로드 필요" 제약).
async function resolveImagePlaceholders(html, images) {
  const tokens = Object.keys(images || {});
  if (tokens.length === 0) return { html, uploadedCount: 0, needsManualUploadFirst: false };

  const uploadUrl = await getUploadUrl();
  if (!uploadUrl) {
    return { html, uploadedCount: 0, needsManualUploadFirst: true };
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  let uploadedCount = 0;
  for (const token of tokens) {
    const imgEl = container.querySelector(`img[data-ezzsearch-token="${CSS.escape(token)}"]`);
    if (!imgEl) continue;
    try {
      const src = await uploadImageToNaver(uploadUrl, images[token], `${token}.png`);
      imgEl.setAttribute("src", src);
      imgEl.removeAttribute("data-ezzsearch-token");
      uploadedCount++;
    } catch (err) {
      console.warn(`[ezzsearch] image upload failed for ${token}:`, err);
      imgEl.replaceWith(document.createTextNode(`[${token} 자동 업로드 실패 — 직접 넣어주세요]`));
    }
  }
  return { html: container.innerHTML, uploadedCount, needsManualUploadFirst: false };
}

async function insertDraft(draft) {
  const titleEl = findFirst(SELECTORS.title);
  const bodyEl = findFirst(SELECTORS.body);

  const { html, uploadedCount, needsManualUploadFirst } = await resolveImagePlaceholders(
    draft.html,
    draft.images
  );

  if (!titleEl && !bodyEl) {
    showToast(
      "에디터 입력창을 찾지 못했어요 — 클립보드에는 복사해뒀으니 Ctrl+V로 직접 붙여넣어 주세요.",
      true
    );
    await copyToRealClipboard(html, `${draft.title}\n\n${stripHtmlToText(html)}`);
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
    simulatePaste(bodyEl, html, stripHtmlToText(html));
  }
  await copyToRealClipboard(html, `${draft.title}\n\n${stripHtmlToText(html)}`);

  if (needsManualUploadFirst) {
    showToast(
      "제목·본문을 넣어봤어요. 사진은 이 에디터에서 아직 업로드 이력이 없어 자동으로 못 넣었어요 — 사진 1장을 직접 한 번 업로드하시면, 그다음부터는 이지서치가 자동으로 올려드려요."
    );
  } else if (uploadedCount > 0) {
    showToast(
      `제목·본문에 사진 ${uploadedCount}장까지 자동으로 넣어봤어요 — 반영이 안 됐다면 Ctrl+V로 직접 붙여넣어 주세요(클립보드에도 복사해뒀어요).`
    );
  } else {
    showToast(
      "제목·본문을 넣어봤어요 — 반영이 안 됐다면 Ctrl+V로 직접 붙여넣어 주세요(클립보드에도 복사해뒀어요)."
    );
  }
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

// 2026-08 사용자 요청("로그인 사용자에 대해 자동으로 붙여넣기가 되었으면") —
// 예전엔 초안이 도착해도 사람이 플로팅 버튼을 눌러야만 삽입을 시도했는데,
// 이제 초안이 감지되면 곧바로 자동으로 삽입을 시도한다. SmartEditor가 아직
// 안 떴을 수 있어(방금 탭을 열었거나 페이지 전환 직후) 제목/본문 입력창이
// 나타날 때까지 최대 AUTO_INSERT_MAX_ATTEMPTS번, AUTO_INSERT_RETRY_MS
// 간격으로 재시도한 뒤 insertDraft를 호출한다. 자동 삽입이 실패해도(선택자가
// §CLAUDE.md 17.4 기준 여전히 미검증이라 안 먹을 수 있음) 클립보드에는
// 항상 복사해두고(insertDraft 내부), 초안이 스토리지에 그대로 남아있으면
// 수동 재시도용 플로팅 버튼을 띄운다 — 자동 삽입이 항상 보장은 아니라는
// 뜻이라 완전히 무음 실패로 두지 않기 위함.
const AUTO_INSERT_RETRY_MS = 1000;
const AUTO_INSERT_MAX_ATTEMPTS = 10; // 최대 약 10초간 에디터가 뜨길 기다림
let autoInsertedSavedAt = null; // 같은 초안을 중복 자동삽입하지 않기 위한 가드

async function autoInsertWithRetry(draft, attempt = 0) {
  const ready = findFirst(SELECTORS.title) || findFirst(SELECTORS.body);
  if (!ready && attempt < AUTO_INSERT_MAX_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, AUTO_INSERT_RETRY_MS));
    return autoInsertWithRetry(draft, attempt + 1);
  }
  await insertDraft(draft);
}

async function tryAutoInsert(draft) {
  if (!draft || draft.savedAt === autoInsertedSavedAt) return;
  autoInsertedSavedAt = draft.savedAt;
  await autoInsertWithRetry(draft);
  // insertDraft가 성공하면 DRAFT_KEY를 지우고 끝남 — 그대로 남아있다면
  // 자동 삽입이 안 된 것이므로(선택자 미검증 등) 수동 재시도 버튼을 띄움.
  const store = await chrome.storage.local.get(DRAFT_KEY);
  if (store[DRAFT_KEY]) showInsertButton(draft);
}

async function checkPendingDraft() {
  const store = await chrome.storage.local.get(DRAFT_KEY);
  const draft = store[DRAFT_KEY];
  if (!draft) return;
  if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
    chrome.storage.local.remove(DRAFT_KEY);
    return;
  }
  tryAutoInsert(draft);
}

// 2026-08(사용자 신고 — "확장으로 보내기가 잘 안되는듯") — 이 content
// script는 manifest.json의 all_frames:true 때문에 SmartEditor 페이지 안의
// 모든 iframe에서 각자 독립적으로 실행됨. 자동 삽입/플로팅 버튼 로직을
// 프레임마다 따로 돌리면, 프레임마다 각자 클립보드에 쓰고(서로 덮어씀) 각자
// 토스트를 띄우는 등 서로 경쟁하면서 "됐다 안 됐다" 하는 것처럼 보일 수
// 있음 — 실제 SmartEditor의 프레임 구조를 이 환경에서는 확인할 방법이
// 없어서(§CLAUDE.md 17.4), 일단 최상위 프레임에서만 자동 삽입/플로팅
// 버튼을 다루도록 보수적으로 제한함(태그 입력창 배지는 프레임별로 독립
// 동작해도 서로 부딪힐 일이 없어 그대로 둠). 만약 제목·본문 입력창이 실제로
// iframe 안에 있다면 이 제한 때문에 자동 삽입이 아예 안 될 수 있는데, 그
// 경우 이 IS_TOP_FRAME 체크를 지우고 다시 all_frames 그대로 두는 실험이
// 필요함 — 실제 브라우저 개발자 도구로 SmartEditor의 iframe 구조를 확인한
// 뒤에 결정할 것.
const IS_TOP_FRAME = window.top === window.self;

if (IS_TOP_FRAME) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[DRAFT_KEY]) return;
    if (changes[DRAFT_KEY].newValue) tryAutoInsert(changes[DRAFT_KEY].newValue);
    else removeInsertButton();
  });

  checkPendingDraft();
}

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
