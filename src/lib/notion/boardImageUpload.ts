// Notion File Upload API — 공식 문서로 확인한 뒤 구현함(§CLAUDE.md 10.4
// "추측 금지" 원칙): POST /v1/file_uploads(mode:"single_part")로 업로드
// 세션을 만들고, 응답의 upload_url에 multipart/form-data로 실제 바이트를
// 보내면 완료된다. @notionhq/client(v5.23) 타입 SDK가 이 엔드포인트를 아직
// 감싸지 않아서(멀티파트 POST가 필요해 타입 SDK와 안 맞기도 함) 이 파일만
// raw fetch로 Notion REST API를 직접 호출 — 이 프로젝트의 다른 외부 API
// 클라이언트들(예: generateAiImages.ts의 OpenAI 호출)과 같은 패턴.
const NOTION_API_BASE = "https://api.notion.com/v1";
// 파일 업로드 API를 지원하는 것으로 문서에서 확인된 버전 — Notion-Version은
// 요청마다 명시해야 함(SDK를 안 거치므로 자동으로 안 붙음).
const NOTION_VERSION = "2026-03-11";

function notionToken(): string {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("Missing NOTION_TOKEN");
  return token;
}

interface CreateFileUploadResponse {
  id: string;
  upload_url: string;
}

// 업로드된 파일의 file_upload id를 반환 — board.ts의 createBoardPost가 이
// id를 그대로 페이지의 "이미지" 속성에 붙인다.
export async function uploadImageToNotion(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const token = notionToken();

  const createRes = await fetch(`${NOTION_API_BASE}/file_uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode: "single_part", filename, content_type: contentType }),
  });
  if (!createRes.ok) {
    throw new Error(`Notion file_uploads create failed (${createRes.status}): ${await createRes.text()}`);
  }
  const created = (await createRes.json()) as CreateFileUploadResponse;

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: contentType }), filename);

  const sendRes = await fetch(created.upload_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
    body: form,
  });
  if (!sendRes.ok) {
    throw new Error(`Notion file_uploads send failed (${sendRes.status}): ${await sendRes.text()}`);
  }

  return created.id;
}
