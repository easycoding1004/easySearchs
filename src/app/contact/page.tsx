import SiteHeader from "@/components/SiteHeader";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "문의하기 — easySerch",
};

export default function ContactPage() {
  return (
    <div className="flex flex-1 flex-col items-center font-sans">
      <SiteHeader />
      <main className="flex w-full max-w-4xl flex-1 flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">문의하기</h1>
          <p className="text-sm text-ink-muted sm:text-base">
            궁금하신 점이나 제안하고 싶은 내용을 남겨주세요.
          </p>
        </div>
        <ContactForm />
      </main>
    </div>
  );
}
