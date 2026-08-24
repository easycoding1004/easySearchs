import SiteHeader from "@/components/SiteHeader";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

// 2026-08 — SiteHeader가 로그인 상태를 보여주려고 async Server Component가
// 되면서(§CLAUDE.md 22 후속), Client Component에서 더 이상 직접 못 렌더링함
// — 폼 로직만 AdminLoginForm.tsx(client)로 분리하고 이 페이지 자체는
// Server Component로 되돌림(/login·/signup과 같은 page+form 분리 패턴).
export default function AdminLoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center justify-center px-4 py-16">
        <AdminLoginForm />
      </main>
    </div>
  );
}
