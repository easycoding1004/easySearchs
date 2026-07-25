import Link from "next/link";

// Mobile-only fixed bottom bar — on a long scrolling page the only other
// CTA sits at the very bottom, so small-viewport visitors need one that's
// always reachable.
export default function MobileStickyCta({ href, label }: { href: string; label: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 px-4 py-3 backdrop-blur sm:hidden">
      <Link
        href={href}
        className="block w-full rounded-md bg-primary px-6 py-3 text-center text-sm font-semibold text-white transition ease-spring hover:bg-primary-hover motion-safe:active:scale-[0.97]"
      >
        {label}
      </Link>
    </div>
  );
}
