import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-mesh opacity-20 pointer-events-none" aria-hidden />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] spotlight-orb opacity-40 pointer-events-none" aria-hidden />
      <div className="absolute top-[30%] -right-40 w-[400px] h-[400px] rounded-full bg-violet-600/[0.04] blur-[140px] pointer-events-none" aria-hidden />

      <Navigation />

      <div className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[260px_minmax(0,1fr)] gap-8">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto pr-2 lg:pr-4 lg:border-r lg:border-white/[0.04]">
            <div className="mb-6 pb-4 border-b border-white/[0.04]">
              <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-1">
                Documentation
              </p>
              <p className="text-sm text-zinc-300">
                Self-serve guides for the Axiom platform.
              </p>
            </div>
            <DocsSidebar />
          </aside>

          {/* Main content */}
          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
