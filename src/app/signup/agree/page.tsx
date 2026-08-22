import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import AgreeForm from "@/components/AgreeForm";

export const metadata: Metadata = {
  title: "약관 동의",
  robots: { index: false, follow: false },
};

export default function SignupAgreePage() {
  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4 py-16 sm:px-6 sm:py-20">
        <AgreeForm />
      </main>
    </div>
  );
}
