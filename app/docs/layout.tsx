import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100">

      <Navigation />

      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-[260px_minmax(0,1fr)] gap-8">
          <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto pr-2 lg:pr-4 lg:border-r lg:border-white/[0.04]">
            <div className="mb-6 pb-4 border-b border-white/[0.04]">
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-widest mb-1">
                Documentation
              </p>
              <p className="text-sm text-zinc-300">
                Self-serve guides for the Axiom platform.
              </p>
            </div>
            <DocsSidebar />
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
