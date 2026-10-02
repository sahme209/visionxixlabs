import type { ReactNode } from "react";

/** Shared visual frame for signed-in browser companion routes. */
export function AuthCompanionShell({ children }: { children: ReactNode }) {
  return (
    <main className="axiom-canvas relative isolate min-h-screen overflow-hidden px-5 py-8 text-white sm:px-8 lg:px-12">
      <div aria-hidden className="absolute inset-0 -z-20 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/images/axiom-hero-landscape-v1.png')" }} />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,12,11,0.82),rgba(11,12,11,0.96)_65%,#0c0d0c)]" />
      {children}
    </main>
  );
}
