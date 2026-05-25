/**
 * Marketing route-group layout.
 *
 * Previously this rendered its own stripped-down nav and footer
 * which made every page under (marketing) — Plans, How it works,
 * Disciplines, Compare, FAQ — look visually disconnected from the
 * homepage. Clicking "Pricing" in the main nav dropped users into
 * a different shell with a different header and a different
 * footer, breaking the "feels like one product" promise.
 *
 * Now the marketing group inherits the SAME Navigation + Footer
 * the homepage uses, so /plans, /how-it-works, /faq etc all share
 * the same chrome as /. The page-level Hero/Sections still render
 * inside, just inside the shared shell.
 *
 * Body background matches the calmed homepage tone (#0a0a0d).
 */

import type { ReactNode } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0d] text-zinc-100">
      <Navigation />
      {/* Top padding matches the fixed-height main nav so content
          doesn't slip beneath it. */}
      <main className="pt-16">{children}</main>
      <Footer />
    </div>
  );
}
