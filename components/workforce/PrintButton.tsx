/**
 * PrintButton — Phase 637.
 *
 * Tiny client component that triggers window.print(). The audit
 * packet page (Phase 637) embeds @media print CSS that strips
 * navigation, sets A4 page geometry, and increases paper contrast.
 * Operator hits "Download PDF", browser print dialog opens, they
 * pick "Save as PDF", done. No server-side PDF library required.
 */

"use client";

import { PrinterIcon } from "@heroicons/react/24/outline";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border border-emerald-500/30 text-emerald-200 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors inline-flex items-center gap-1.5"
      title="Open the browser print dialog; choose 'Save as PDF'"
    >
      <PrinterIcon className="h-3 w-3" />
      download pdf
    </button>
  );
}
