import Image from "next/image";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/easyserch_icon.svg" alt="easySerch" width={24} height={24} />
            <span className="text-sm font-semibold text-ink">블로그지수</span>
          </Link>
          <Link href="/" className="text-sm text-ink-muted transition-colors hover:text-ink">
            키워드 빠른 조회
          </Link>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
