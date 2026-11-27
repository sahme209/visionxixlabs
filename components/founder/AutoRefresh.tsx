"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the page's server data every minute while the tab is visible, and says how fresh it is. */
export function AutoRefresh({ generatedAt, everyMs = 60_000 }: { generatedAt: string; everyMs?: number }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, everyMs);
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => { clearInterval(refresh); clearInterval(tick); };
  }, [router, everyMs]);
  const secs = Math.max(0, Math.round((now - Date.parse(generatedAt)) / 1000));
  return (
    <p className="flex items-center gap-2 text-xs text-zinc-400" aria-live="polite">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/70 motion-reduce:hidden" /><span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" /></span>
      Live · updated {secs < 10 ? "just now" : secs < 120 ? `${secs} s ago` : `${Math.round(secs / 60)} min ago`}
      <button type="button" onClick={() => router.refresh()} className="rounded-md bg-white/5 px-2 py-0.5 text-zinc-300 hover:bg-white/10">Refresh</button>
    </p>
  );
}
