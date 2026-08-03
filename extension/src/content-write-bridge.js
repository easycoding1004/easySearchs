// ezzsearch.com/write 페이지에서만 실행됨(manifest.json content_scripts
// matches) — 페이지가 window.postMessage로 보내는 초안을 받아 background로
// 중계함. 이 파일이 유일하게 "웹페이지 ↔ 확장" 경계를 넘는 지점이라, 여기서
// event.source/origin을 반드시 확인해야 함(다른 탭·iframe이 흉내 낸 메시지를
// 그냥 믿으면 안 됨).
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  if (!event.data || event.data.source !== "ezzsearch-write" || event.data.type !== "SEND_DRAFT") return;

  // 2026-08 사용자 신고("확장으로 보내기 버튼을 여러 번 클릭하면 콘솔에
  // Uncaught Error: Extension context invalidated") — 확장을 리로드했는데
  // 이 탭이 그 이전부터 열려 있던 경우, 여기 심어진 content script 인스턴스는
  // 예전 확장 컨텍스트를 그대로 물고 있어서 chrome.runtime.sendMessage 호출
  // 자체가 동기적으로 throw됨(§CLAUDE.md 17.4에 이미 같은 원인으로 기록된
  // 문제 — "관련 탭을 전부 닫고 새로 열어야" 진짜로 해결됨, 코드로는 못 고침).
  // 다만 지금까지는 이 throw를 못 잡아서 콘솔에 무서운 에러로 그대로
  // 노출됐었음 — try/catch로 감싸서 조용히 무시하면, ACK가 영영 안 와서
  // BlogWriterForm.tsx의 기존 소프트/하드 타임아웃이 "설치 안 된 것 같다"는
  // 안내를 정상적으로 띄워줌(이미 있는 처리 경로를 그대로 탐).
  try {
    if (!chrome?.runtime?.id) throw new Error("extension context invalidated");
    chrome.runtime.sendMessage({ type: "STORE_DRAFT", payload: event.data.payload }, () => {
      void chrome.runtime.lastError; // 백그라운드가 응답 안 해도(수신자 없음 등) 무시 — ACK 타임아웃이 처리함
      window.postMessage({ source: "ezzsearch-extension", type: "DRAFT_ACK" }, window.location.origin);
    });
  } catch (err) {
    console.warn(
      "[ezzsearch] chrome.runtime.sendMessage failed (아마 확장이 리로드된 뒤 이 탭을 새로고침 안 함) — 관련 탭을 닫고 새로 열어보세요:",
      err
    );
  }
});
