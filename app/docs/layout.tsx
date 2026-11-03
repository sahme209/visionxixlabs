import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { DocsContents } from "@/components/docs/DocsContents";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100">

      <Navigation />

      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-[260px_minmax(0,1fr)] gap-8">
          <DocsContents />

          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
