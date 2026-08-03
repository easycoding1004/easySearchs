// 게시판 전용 초경량 파서(§CLAUDE.md 16 참고) — AI 블로그의 parseBody.ts
// (SLOT/GALLERY 등 복잡한 블록 마크업)는 게시판엔 과해서 안 가져오고,
// "[이미지N]" 토큰 하나만 처리하는 새 파서를 둠. BoardPostForm.tsx가
// 붙여넣기/업로드 시 이 토큰을 항상 빈 줄로 둘러싸서 삽입하므로(자체
// 블록으로 취급), 빈 줄 2개 이상으로 나눈 블록 단위로 판정하면 충분하다.
export type PostBlock = { type: "paragraph"; text: string } | { type: "image"; index: number };

const IMAGE_BLOCK = /^\[이미지(\d+)\]$/;

export function parsePostBody(body: string): PostBlock[] {
  const blocks = body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return blocks.map((block): PostBlock => {
    const match = IMAGE_BLOCK.exec(block);
    if (match) return { type: "image", index: Number(match[1]) };
    return { type: "paragraph", text: block };
  });
}

// 목록 카드용 — 이미지 토큰과 여분의 줄바꿈을 걷어낸 순수 텍스트 미리보기.
export function stripPostBodyPreview(body: string, maxLength = 80): string {
  const text = parsePostBody(body)
    .filter((b) => b.type === "paragraph")
    .map((b) => (b.type === "paragraph" ? b.text : ""))
    .join(" ");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
