import { useEffect, useState } from "react";
import { desktopClient } from "../lib/desktopClient";

type Summary = { total: number; passed: number; failed: number; missing: number };

/** Blocking deployment check results reported for one exact commit. Evidence only; unavailable shows nothing. */
export function CommitChecksLine({ sha }: { sha: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    if (!/^[0-9a-f]{40}$/.test(sha)) return;
    let live = true;
    Promise.resolve().then(() => desktopClient.summarizeCommitChecks([sha])).then((r) => { if (live && r.ok) setSummary(r.data?.commits?.[sha] ?? null); }).catch(() => {});
    return () => { live = false; };
  }, [sha]);
  if (!summary || summary.total === 0) return null;
  const text = summary.failed ? `${summary.failed} of ${summary.total} blocking checks failed` : summary.missing ? `${summary.passed} of ${summary.total} blocking checks passed; ${summary.missing} not reported` : `All ${summary.total} blocking checks passed`;
  return <p className="text-xs text-zinc-400" aria-label="Deployment checks for this commit">Deployment checks for this commit: <span className={summary.failed ? "text-rose-300" : summary.missing ? "text-amber-300" : "text-emerald-300"}>{text}</span></p>;
}
