"use client";

import { useState } from "react";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";

/**
 * Tiny client-side "Copy" overlay button for the launch-kit page.
 * Lives in a separate file so the parent page stays a server component.
 */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (no permission, http) — silent fail.
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[10.5px] font-mono uppercase tracking-wider text-zinc-300 hover:bg-brand-coral/[0.10] hover:border-brand-coral/30 hover:text-brand-coral transition-all"
    >
      {copied ? (
        <>
          <CheckIcon className="h-3 w-3 text-emerald-300" />
          <span className="text-emerald-300">Copied</span>
        </>
      ) : (
        <>
          <ClipboardDocumentIcon className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
