import type { Metadata } from "next";

// /admin, /admin/login 전부 이 레이아웃 아래라 여기 한 번만 선언하면 됨.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
