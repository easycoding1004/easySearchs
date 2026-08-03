import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BoardPostEditForm from "@/components/board/BoardPostEditForm";
import { getBoardPost } from "@/lib/notion/board";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminAuthed } from "@/lib/auth/adminAuth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "게시글 수정" };

// 작성 당사자 또는 관리자만 접근 가능 — API 라우트(PATCH)도 같은 조건을
// 다시 검증하지만, 여기서도 미리 막아야 권한 없는 사람이 폼 자체를 보고
// "수정 권한이 없어요" 에러를 제출 시점에야 만나는 어색한 경험을 피함.
export default async function BoardPostEditPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const [post, user, admin] = await Promise.all([getBoardPost(postId), getCurrentUser(), isAdminAuthed()]);

  if (!post) notFound();
  if (!admin && (!user || user.pageId !== post.authorId)) {
    redirect(`/board/${postId}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">게시글 수정</h1>
        <BoardPostEditForm postId={post.id} initialTitle={post.title} initialBody={post.body} />
      </main>
    </div>
  );
}
