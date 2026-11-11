import { GROUP_LABEL, INTEGRATION_LOGOS, type IntegrationGroup } from "@/lib/marketing/integrationLogos";
import styles from "./integrationsHubFlow.module.css";

const GROUPS: IntegrationGroup[] = ["source", "cloud", "orchestration", "signals", "data", "work"];
const CHECKS = [
  ["Scoped connection", "Each tool connects to one workspace with the least access it needs. Credentials stay encrypted on the server."],
  ["Policy and approval", "Reads run inline. Changes become an exact proposal that a person approves before anything runs."],
  ["Recorded outcome", "Every read, decision and result lands in the sealed audit log."],
] as const;
const OUTCOMES = ["Context for the Agent", "A reviewed pull request", "A governed deployment", "Evidence you can verify"];

/** Short labels keep tool names readable in narrow cards; the full status is in the catalog below. */
const SHORT: Record<string, string> = { "implementation review": "in review", "configuration required": "setup needed" };
const shortStatus = (s: string) => SHORT[s] ?? s;
const statusTone = (s: string) => (s === "available" ? "text-emerald-300/90" : s === "planned" ? "text-zinc-600" : "text-amber-200/80");

/** Integrations page: tools → Axiom checks → outcomes. Calm 2D, real logos, real statuses. */
export function IntegrationsHubFlow() {
  return (
    <section aria-labelledby="hub-flow" className="rounded-2xl border border-white/[0.07] bg-white/1.5 p-5 sm:p-7">
      <h2 id="hub-flow" className="text-xl font-medium tracking-tight text-zinc-100">How your tools connect through Axiom</h2>
      <p className="mt-2 max-w-3xl text-[15px] leading-7 text-zinc-400">Tools on the left, Axiom&apos;s checks in the middle, outcomes on the right. Statuses are the real ones from the catalog below.</p>
      <div className="mt-7 grid items-stretch gap-4 lg:grid-cols-[minmax(0,5fr)_auto_minmax(0,4fr)_auto_minmax(0,3fr)]">
        <ol aria-label="Tools" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
          {GROUPS.map((g) => (
            <li key={g} className="rounded-xl border border-white/[0.07] bg-[#0b0e13] p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{GROUP_LABEL[g]}</p>
              <ul className="mt-2 space-y-1.5">
                {INTEGRATION_LOGOS.filter((i) => i.group === g).map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-[13px] text-zinc-300">
                    {i.logo ? <img src={i.logo} alt="" width={14} height={14} className="h-3.5 w-3.5 opacity-70 invert" loading="lazy" /> : <span aria-hidden="true" className="h-3.5 w-3.5 rounded-xs border border-white/20" />}
                    <span className="truncate">{i.name}</span>
                    <span title={i.status} className={`ml-auto shrink-0 text-[10px] ${statusTone(i.status)}`}>{shortStatus(i.status)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <div aria-hidden="true" className={`hidden lg:block ${styles.pipe}`}><span className={styles.dot} /><span className={`${styles.dot} ${styles.d2}`} /></div>
        <ol aria-label="Axiom checks" className="flex flex-col justify-center gap-3 rounded-xl border border-sky-300/15 bg-sky-300/3 p-4">
          <li className="text-[11px] uppercase tracking-[0.14em] text-sky-200/70">Axiom</li>
          {CHECKS.map(([t, d], i) => (
            <li key={t} className="rounded-lg border border-white/[0.07] bg-[#0b0e13] px-3 py-2.5">
              <p className="text-sm text-zinc-100"><span className="mr-2 font-mono text-xs text-sky-200/70">{String(i + 1).padStart(2, "0")}</span>{t}</p>
              <p className="mt-1 text-[13px] leading-5 text-zinc-400">{d}</p>
            </li>
          ))}
        </ol>
        <div aria-hidden="true" className={`hidden lg:block ${styles.pipe}`}><span className={styles.dot} /><span className={`${styles.dot} ${styles.d2}`} /></div>
        <ol aria-label="Outcomes" className="flex flex-col justify-center gap-3">
          {OUTCOMES.map((o) => <li key={o} className="rounded-lg border border-emerald-300/15 bg-emerald-300/3 px-3 py-2.5 text-sm text-zinc-200">{o}</li>)}
        </ol>
      </div>
      <p className="mt-5 text-[11px] text-zinc-600">Logos are trademarks of their owners and do not imply endorsement. &ldquo;Available&rdquo; means a released path exists; preview, review and planned items are not release-verified.</p>
    </section>
  );
}
