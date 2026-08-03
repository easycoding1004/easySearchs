import { parsePostBody } from "@/lib/board/parsePost";

// 순수 렌더링이라 서버 컴포넌트로 둠 — 이미지는 항상 프록시 라우트
// (/api/board/image/[postId]/[index])를 거치게 해서 Notion의 1시간짜리
// 임시 URL 만료를 감춘다(§CLAUDE.md 16).
export default function PostBody({ postId, body }: { postId: string; body: string }) {
  const blocks = parsePostBody(body);
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) =>
        block.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={`/api/board/image/${postId}/${block.index - 1}`}
            alt=""
            className="w-full rounded-md border border-hairline object-cover"
          />
        ) : (
          <p key={i} className="whitespace-pre-wrap text-sm text-ink">
            {block.text}
          </p>
        )
      )}
    </div>
  );
}
