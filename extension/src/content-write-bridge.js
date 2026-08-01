// ezzsearch.com/write 페이지에서만 실행됨(manifest.json content_scripts
// matches) — 페이지가 window.postMessage로 보내는 초안을 받아 background로
// 중계함. 이 파일이 유일하게 "웹페이지 ↔ 확장" 경계를 넘는 지점이라, 여기서
// event.source/origin을 반드시 확인해야 함(다른 탭·iframe이 흉내 낸 메시지를
// 그냥 믿으면 안 됨).
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  if (!event.data || event.data.source !== "ezzsearch-write" || event.data.type !== "SEND_DRAFT") return;

  chrome.runtime.sendMessage({ type: "STORE_DRAFT", payload: event.data.payload }, () => {
    window.postMessage({ source: "ezzsearch-extension", type: "DRAFT_ACK" }, window.location.origin);
  });
});
