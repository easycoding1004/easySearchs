import { getBoardPostImageUrl } from "@/lib/notion/board";

// Notion 호스팅 파일 URL은 1시간짜리 임시 URL이라(공식 문서 확인, §CLAUDE.md
// 16 게시판 항목) 정적으로 저장해두면 안 됨 — 게시글 렌더링은 항상
// <img src="/api/board/image/{postId}/{index}">를 거치게 해서, 매 요청마다
// 이 라우트가 그 순간 유효한 URL을 새로 물어와 302로 넘겨준다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string; index: string }> }
) {
  const { postId, index } = await params;
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) {
    return new Response("Not found", { status: 404 });
  }

  const url = await getBoardPostImageUrl(postId, i);
  if (!url) {
    return new Response("Not found", { status: 404 });
  }

  return Response.redirect(url, 302);
}
