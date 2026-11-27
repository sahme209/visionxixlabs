import { TONE_DOT, type StatusTone } from "@/lib/cockpit/statusTone";

type Day = { succeeded: number; failed: number; running: number; other: number };
const PARTS: Array<[keyof Day, StatusTone, string]> = [["failed", "failed", "Failed"], ["running", "running", "Running"], ["other", "idle", "Other or not recorded"], ["succeeded", "success", "Succeeded"]];

/**
 * Runs per day as stacked bars in the cockpit palette, oldest day on the left. Each bar has a text label
 * (day and counts) and the legend carries totals, so colour is never the only signal.
 */
export function DailyOutcomeBars({ days, endDate, label }: { days: readonly Day[]; endDate: Date; label: string }) {
  const max = Math.max(1, ...days.map((d) => d.succeeded + d.failed + d.running + d.other));
  const totals = PARTS.map(([key, tone, text]) => ({ key, tone, text, count: days.reduce((n, d) => n + d[key], 0) })).filter((p) => p.count > 0);
  const dayLabel = (i: number) => new Date(endDate.getTime() - (days.length - 1 - i) * 86_400_000).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <figure aria-label={label} className="mt-4">
      <ul className="flex h-24 items-end gap-[3px]">{days.map((d, i) => {
        const total = d.succeeded + d.failed + d.running + d.other;
        const text = `${dayLabel(i)}: ${total === 0 ? "no runs" : PARTS.filter(([k]) => d[k] > 0).map(([k, , t]) => `${d[k]} ${t.toLowerCase()}`).join(", ")}`;
        return <li key={i} role="img" aria-label={text} title={text} className="flex h-full flex-1 flex-col justify-end">
          {total === 0 ? <span className="block h-px w-full bg-white/10" /> : <span className="flex w-full flex-col overflow-hidden rounded-[2px]" style={{ height: `${(total / max) * 100}%` }}>
            {PARTS.filter(([k]) => d[k] > 0).map(([k, tone]) => <span key={k} className={`block w-full ${TONE_DOT[tone]}`} style={{ flexGrow: d[k] }} />)}
          </span>}
        </li>;
      })}</ul>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
        <span>{dayLabel(0)} to {dayLabel(days.length - 1)} (UTC)</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1">{totals.map((t) => <span key={t.key} className="inline-flex items-center gap-1.5"><span aria-hidden className={`h-2 w-2 rounded-[2px] ${TONE_DOT[t.tone]}`} />{t.text} <span className="tabular-nums text-zinc-200">{t.count}</span></span>)}</span>
      </figcaption>
    </figure>
  );
}
