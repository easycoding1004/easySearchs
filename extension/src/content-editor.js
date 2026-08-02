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

// 2026-08 디버그 로그(사용자 신고 — "확장으로 보내기가 여전히 안 됨") — 선택자는
// mainFrame 컨텍스트에서 실측으로 맞는 걸 확인했는데도 계속 실패해서, 이 content
// script가 실제로 어느 프레임에서 실행되고 어디까지 진행되는지 눈으로 보기 위해
// 추가함. Console 패널은 기본적으로 모든 프레임의 로그를 한 곳에 모아서 보여주므로
// (프레임을 따로 선택할 필요 없음), "[ezzsearch]"로 필터링해서 보면 전체 흐름을
// 한눈에 볼 수 있음 — 원인이 확인되면 다시 지울 것.
function log(...args) {
  console.log("[ezzsearch]", `frame=${location.href.slice(0, 60)}`, ...args);
}
log("content-editor.js loaded");

function findFirst(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

// 2026-08 실측 확인 — 제목·본문 모두 focus()를 걸어도 "focus did not
// stick"으로 매번 실패하는 게 확인됨. SELECTORS로 찾은 요소가 실제로는
// contenteditable이 걸린 진짜 편집 지점이 아니라 그걸 감싸는 바깥 컨테이너일
// 가능성이 높음(§CLAUDE.md 17.4 — contenteditable 속성 확인은 애초에 실측
// 범위 밖이었음, 실제 DOM 캡처 스크린샷도 class만 보여줬지 이 속성 자체는
// 안 보임). 자기 자신이 contenteditable이 아니면 그 안에서 진짜
// contenteditable 요소를 찾아 그걸 실제 대상으로 쓴다 — 못 찾으면 원래
// 요소라도 그대로 반환(기존 동작 유지, 새로운 실패 경로를 안 만듦).
function resolveEditableTarget(el) {
  if (!el) return null;
  if (el.getAttribute("contenteditable") === "true") return el;
  const inner = el.querySelector('[contenteditable="true"]');
  return inner || el;
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

// 2026-08 실측 확인 — simulatePaste(합성 paste 이벤트)가 SmartEditor에서
// 요소를 찾는 데는 성공해도(titleEl/bodyEl 둘 다 true) 실제로 텍스트가
// 안 들어가는 걸 사용자가 직접 확인해줌. 합성 ClipboardEvent는
// `isTrusted: false`라 SmartEditor의 paste 핸들러가 이를 무시하는 것으로
// 보임(추정 — SmartEditor 내부 로직을 직접 볼 방법은 없음). `execCommand`는
// 표준에서 deprecated로 표시돼 있지만 Chrome이 아직 지원하고, 브라우저의
// 실제 텍스트 편집 파이프라인을 타기 때문에 순수 합성 이벤트보다 에디터가
// "진짜 입력"으로 인식할 가능성이 더 높음 — 그래서 이걸 1차 시도로 두고,
// 실패하면(반환값 false) simulatePaste로 폴백한다. 본문은 서식을 살리려고
// `insertHTML`을 먼저 시도하고, 그게 안 먹으면(반환값 false) `insertText`로
// 평문만이라도 넣는다.
function insertViaExecCommand(target, plainText, html) {
  if (!target) return false;
  target.focus();
  try {
    if (html) {
      if (document.execCommand("insertHTML", false, html)) return true;
    }
    return document.execCommand("insertText", false, plainText);
  } catch (err) {
    console.warn("[ezzsearch] execCommand insert failed:", err);
    return false;
  }
}

// 2026-08 — chrome.debugger(CDP `Input.insertText`)로 진짜 자동 입력을
// 시도했다가(v0.5.0) "브라우저가 꺼진다"는 신고로 한 번 되돌렸었음
// (v0.5.1). 재조사 결과 진짜 원인은 이게 아니라 BlogWriterForm.tsx가 ACK
// 타임아웃 시 방금 자동으로 연 탭을 직접 `editorTab?.close()`로 닫아버리던
// 별개의 버그였음 — 그 버그를 고친 뒤 사용자 요청으로 CDP 방식을 다시
// 적용함(v0.5.2). execCommand/simulatePaste는 페이지 스크립트가 만드는
// 이벤트라 `isTrusted: false`를 절대 벗어날 수 없어서 SmartEditor가 무시하는
// 것으로 실측 확인됐지만, CDP는 브라우저 엔진 차원에서 입력이 주입돼 페이지
// 입장에서 실제 사용자 입력과 구분이 안 됨 — 지금까지 시도한 것과 근본적으로
// 다른 방법이라 1차 시도로 둠. DevTools가 이미 열려 있는 탭이면 attach 자체가
// 실패할 수 있음(크롬이 동시 디버깅 세션을 허용 안 함) — 그 경우 반환값이
// false라 호출부가 execCommand로 자동 폴백한다.
function cdpInsertText(text) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CDP_INSERT_TEXT", text }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: "no response" });
    });
  });
}

// 2026-08 — `document.activeElement === target` 사전 검증 방식을 폐기함.
// 실측 콘솔 로그(Chrome이 자체적으로 띄운 "Blocked aria-hidden on a <body>
// element..." 경고)로 확인된 사실: 제목·본문의 진짜 키 입력 캡처 지점은
// SmartEditor가 IME(한글 조합) 처리를 위해 화면 밖으로 회전시켜(rotateX)
// 숨겨둔 별도의 `<body contenteditable="true">`이고, 우리가 보이는
// title/body 요소에 focus()를 걸어도 SmartEditor가 즉시 그 숨은 캡처
// 지점으로 포커스를 되돌린다 — 즉 `document.activeElement`가 우리 target과
// 같아지는 경우 자체가 없음, 지금까지의 "focus did not stick" 실패는 이
// 방식이 애초에 틀린 전제(단순 contenteditable focus 유지)로 검증하고
// 있었던 것. 그래서 이 사전 검증은 버리고, 대신: (1) focus()+click()으로
// SmartEditor에게 "이 필드가 활성"이라는 내부 상태를 만들어줄 시간을 충분히
// 준 뒤(300ms — 예전 80ms보다 늘림, 이 지연 부족이 title↔body 오삽입 사고의
// 원인 중 하나로 의심됨) CDP를 보내고, (2) 보낸 뒤 실제로 화면(textContent)이
// 바뀌었는지 사후 비교로 성공 여부를 판단한다 — 포커스 위치를 추측하는 대신
// 결과를 직접 확인하는 더 확실한 신호.
async function insertViaDebugger(target, text) {
  if (!target) return false;
  const before = target.textContent || "";
  target.focus();
  target.click?.();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const result = await cdpInsertText(text);
  if (!result.ok) {
    console.warn("[ezzsearch] cdpInsertText failed:", result.error);
    return false;
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  const after = target.textContent || "";
  const landed = after !== before && after.length > before.length;
  log("insertViaDebugger: landed=", landed, "before.len=", before.length, "after.len=", after.length);
  return landed;
}

function cdpInsertTags(tags) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CDP_INSERT_TAGS", tags }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: "no response" });
    });
  });
}

// 2026-08(사용자 요청 — "태그도 자동으로 삽입이 어려운가") — 네이버 태그
// 입력창은 붙여넣기로 들어온 텍스트 뭉치에서 쉼표를 구분자가 아니라 글자로
// 인식해서 여러 태그가 하나로 뭉치는 것으로 실측 확인됨(§CLAUDE.md 16) —
// Enter/쉼표 "키 입력 이벤트"로만 태그를 분리하기 때문. background.js의
// cdpInsertTags가 태그마다 Input.insertText로 글자를 넣고 Input.dispatchKeyEvent로
// Enter 키다운·키업을 보내 하나씩 확정시킴. **`SELECTORS.tagInput`은
// 제목·본문과 달리 아직 실측 미확정**(`#fake-input`이 tabindex=-1·
// aria-hidden=true라 진짜 타이핑 대상이 아닐 수 있음, §CLAUDE.md 17.4) —
// 그래서 이 함수는 순수 보너스 시도로 두고, 실패해도 기존 "태그 하나씩
// 클릭해서 복사" 수동 흐름(웹사이트 쪽)이 그대로 남아있어 손해가 없음.
async function insertTagsViaDebugger(target, tags) {
  if (!target || !tags || tags.length === 0) return false;
  // 위 insertViaDebugger와 같은 이유로 activeElement 사전 검증을 없애고
  // focus()+click() 후 충분히 기다렸다가 CDP를 보낸다 — 태그 입력창은
  // 성공 시 자기 자신을 비우는 UI라 title/body처럼 사후 textContent
  // 비교로 검증할 수 없어서, CDP 명령 자체의 성공 여부(result.ok)만 신뢰한다.
  target.focus();
  target.click?.();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const result = await cdpInsertTags(tags);
  if (!result.ok) console.warn("[ezzsearch] cdpInsertTags failed:", result.error);
  return result.ok;
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

// 2026-08 사용자 신고("단락 사이 빈 줄이 없다") — 예전엔 innerHTML을 파싱한
// 뒤 .textContent만 읽었는데, textContent는 <p>/<h3>/<blockquote> 같은
// 블록 요소 경계를 무시하고 텍스트를 그냥 다 이어붙임 — CDP/execCommand로
// 평문을 넣을 때(§CLAUDE.md 17.5) 문단 구분이 통째로 사라지는 원인이었음.
// renderBodyToHtmlForExtension()이 최상위 블록 요소들을 평평하게(중첩 없이)
// 나열하는 구조라, 최상위 자식 요소마다 텍스트를 따로 뽑아 빈 줄(\n\n)로
// 이어붙이면 문단 구분이 살아남는다.
function stripHtmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const parts = [];
  for (const child of div.children) {
    const text = child.textContent?.trim();
    if (text) parts.push(text);
  }
  return parts.length > 0 ? parts.join("\n\n") : div.textContent || "";
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
  log("insertDraft: titleEl=", !!titleEl, "bodyEl=", !!bodyEl);
  // SELECTORS로 찾은 요소가 실제 편집 가능한(contenteditable) 지점이
  // 아니라 그걸 감싸는 컨테이너일 수 있음 — focus()가 안 먹히는 원인으로
  // 실측 확인됨(resolveEditableTarget 정의부 주석 참고). 이후 모든
  // 포커스·삽입 시도는 이 "진짜 대상"을 씀.
  const titleTarget = resolveEditableTarget(titleEl);
  const bodyTarget = resolveEditableTarget(bodyEl);
  if (titleTarget !== titleEl || bodyTarget !== bodyEl) {
    log("insertDraft: resolved inner editable target", "title changed=", titleTarget !== titleEl, "body changed=", bodyTarget !== bodyEl);
  }

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

  let titleInserted = false;
  let bodyInserted = false;

  if (titleTarget) {
    if ("value" in titleTarget) {
      titleTarget.value = draft.title;
      titleTarget.dispatchEvent(new Event("input", { bubbles: true }));
      titleInserted = true;
    } else {
      titleInserted = await insertViaDebugger(titleTarget, draft.title);
      log("title insertViaDebugger=", titleInserted);
      if (!titleInserted) {
        titleInserted = insertViaExecCommand(titleTarget, draft.title, null);
        log("title insertViaExecCommand=", titleInserted);
      }
      if (!titleInserted) simulatePaste(titleTarget, draft.title, draft.title);
    }
  }
  if (bodyTarget) {
    // CDP Input.insertText는 평문만 넣을 수 있어(서식 없음) — 자동 삽입
    // 성공을 우선하기로 했으므로(사용자 요청) 평문으로라도 자동으로 들어가는
    // 쪽을 먼저 시도하고, 실패하면 서식이 남아있는 execCommand(insertHTML)로
    // 폴백한다. 어느 쪽이든 서식 포함 버전은 클립보드에 항상 같이 복사해두므로
    // (아래 copyToRealClipboard) 필요하면 사용자가 직접 다시 붙여넣을 수 있음.
    bodyInserted = await insertViaDebugger(bodyTarget, stripHtmlToText(html));
    log("body insertViaDebugger=", bodyInserted);
    if (!bodyInserted) {
      bodyInserted = insertViaExecCommand(bodyTarget, stripHtmlToText(html), html);
      log("body insertViaExecCommand=", bodyInserted);
    }
    if (!bodyInserted) simulatePaste(bodyTarget, html, stripHtmlToText(html));
  }

  const tagInputEl = findFirst(SELECTORS.tagInput);
  let tagsInserted = false;
  if (tagInputEl && Array.isArray(draft.tags) && draft.tags.length > 0) {
    tagsInserted = await insertTagsViaDebugger(tagInputEl, draft.tags);
    log("tags insertTagsViaDebugger=", tagsInserted);
  }
  const tagsNote =
    tagInputEl && draft.tags?.length > 0
      ? tagsInserted
        ? ` 태그 ${draft.tags.length}개도 자동으로 넣었어요.`
        : " 태그는 자동으로 안 됐어요 — 결과 화면에서 태그를 하나씩 클릭해 복사한 뒤 붙여넣어 주세요."
      : "";

  await copyToRealClipboard(html, `${draft.title}\n\n${stripHtmlToText(html)}`);

  // 2026-08 — CDP(insertViaDebugger)의 성공 여부는 브라우저 프로토콜 응답
  // 기반이라 execCommand의 반환값보다 훨씬 신뢰할 수 있음(execCommand는
  // "명령을 인식했는지"만 알려줄 뿐 SmartEditor가 실제로 반영했는지는
  // 보장 못 함 — 반환값 true여도 화면엔 안 들어간 사례 확인됨). 그래서
  // titleInserted/bodyInserted가 true면(=CDP 또는 execCommand 둘 중 하나가
  // 진짜로 성공) "Ctrl+V를 눌러달라"는 안내를 하지 않음 — 이미 채워진 곳에
  // 또 붙여넣으면 내용이 중복되기 때문. 실패한 필드에만 커서를 옮겨주고
  // Ctrl+V를 안내한다.
  if (titleTarget && !titleInserted) {
    titleTarget.focus();
    if (bodyTarget && !bodyInserted) {
      titleTarget.addEventListener("input", () => bodyTarget.focus(), { once: true });
    }
  } else if (bodyTarget && !bodyInserted) {
    bodyTarget.focus();
  }

  if (needsManualUploadFirst) {
    showToast(
      `제목·본문을 넣어봤어요. 사진은 이 에디터에서 아직 업로드 이력이 없어 자동으로 못 넣었어요 — 사진 1장을 직접 한 번 업로드하시면, 그다음부터는 이지서치가 자동으로 올려드려요.${tagsNote}`
    );
  } else if (titleInserted && bodyInserted) {
    showToast(`제목·본문에 자동으로 넣었어요${uploadedCount > 0 ? ` (사진 ${uploadedCount}장도 함께)` : ""}!${tagsNote}`);
  } else if (titleInserted || bodyInserted) {
    const failedField = titleInserted ? "본문" : "제목";
    showToast(
      `${titleInserted ? "제목" : "본문"}은 자동으로 넣었는데 ${failedField}은 안 됐어요 — ${failedField}란에 커서를 놔뒀으니 Ctrl+V를 눌러주세요(클립보드에 이미 복사해뒀어요).${tagsNote}`
    );
  } else {
    showToast(
      `자동 삽입이 안 됐어요 — 제목란에 커서를 놔뒀으니 Ctrl+V, 그다음 본문에서 Ctrl+V 한 번 더 눌러주세요(클립보드에 이미 복사해뒀어요, 제목에 붙여넣으면 커서가 본문으로 자동으로 넘어가요).${tagsNote}`
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
  log("autoInsertWithRetry: attempt=", attempt, "ready=", !!ready);
  if (ready) {
    await insertDraft(draft);
    return;
  }
  if (attempt < AUTO_INSERT_MAX_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, AUTO_INSERT_RETRY_MS));
    return autoInsertWithRetry(draft, attempt + 1);
  }
  // 2026-08 실측으로 발견한 문제: SmartEditor는 mainFrame이라는 iframe 안에
  // 있어서(제목·본문이 그 iframe에만 존재), all_frames:true인 이 스크립트는
  // 최상위 페이지에서도 별도로 실행되는데 그 프레임엔 애초에 제목·본문이
  // 없어 절대 못 찾음 — 그런데도 10번을 다 재시도한 뒤 여기 도달해서
  // insertDraft를 부르면 "찾지 못했다" 토스트를 띄워버림. mainFrame 쪽은
  // 보통 훨씬 빨리(1~2초 안에) 성공하므로, 이 프레임이 10초를 다 채웠을
  // 즈음엔 이미 mainFrame이 성공해서 DRAFT_KEY를 지웠을 가능성이 높음 —
  // 그 경우 굳이 이 프레임에서 또 실패 토스트를 띄워 성공 메시지를 덮어쓸
  // 필요가 없으므로, 스토리지에 초안이 남아있는지 먼저 확인하고 이미
  // 없으면(다른 프레임이 처리 완료) 조용히 넘어간다.
  const store = await chrome.storage.local.get(DRAFT_KEY);
  if (!store[DRAFT_KEY]) {
    log("autoInsertWithRetry: draft already consumed by another frame, skipping insertDraft/toast");
    return;
  }
  await insertDraft(draft);
}

async function tryAutoInsert(draft) {
  log("tryAutoInsert called, savedAt=", draft?.savedAt, "alreadyHandled=", draft?.savedAt === autoInsertedSavedAt);
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
  log("checkPendingDraft: found=", !!draft);
  if (!draft) return;
  if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
    chrome.storage.local.remove(DRAFT_KEY);
    return;
  }
  tryAutoInsert(draft);
}

// 2026-08(사용자 신고 — "확장으로 보내기가 잘 안되는듯") — 한 번은 이걸
// 최상위 프레임에서만 돌게 제한했었는데(프레임끼리 경쟁할까 봐), 그게
// 오히려 진짜 원인이었음: 사용자가 개발자 도구 Console의 프레임 드롭다운으로
// 실측 확인한 결과, 제목·본문(SmartEditor 본체)은 최상위 페이지가 아니라
// **`mainFrame`이라는 iframe(주소 패턴 PostWriteForm.naver, blog.naver.com
// 도메인이라 all_frames:true로 이미 스크립트는 주입되고 있었음)** 안에
// 있었음 — 최상위 프레임 제한 때문에 정작 title/body를 찾을 수 있는 그
// iframe 쪽 스크립트 인스턴스는 아예 시도조차 안 하고 있었던 것. 그래서
// 그 제한을 되돌림 — 프레임마다 독립적으로 시도하되, `SELECTORS`가 충분히
// 구체적이라(`.se-section-documentTitle...`, `[data-a11y-title="본문"]`)
// 관련 없는 프레임(예: `mainFrame` 밑의 `input_buffer...` 프레임)에서는
// 그냥 아무것도 못 찾고 조용히 넘어갈 뿐이라 실질적인 충돌 위험은 낮음.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[DRAFT_KEY]) return;
  log("storage.onChanged fired, hasNewValue=", !!changes[DRAFT_KEY].newValue);
  if (changes[DRAFT_KEY].newValue) tryAutoInsert(changes[DRAFT_KEY].newValue);
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
