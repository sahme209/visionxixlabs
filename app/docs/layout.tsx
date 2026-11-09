import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { DocsContents } from "@/components/docs/DocsContents";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="axiom-canvas min-h-screen text-zinc-100">

      <Navigation />

      <div className="pt-28 pb-20 px-5 sm:px-8 lg:px-10 lg:pt-36">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-[260px_minmax(0,1fr)] gap-8">
          <DocsContents />

          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
