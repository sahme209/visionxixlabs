import type { StatusTone } from "./StatusBadge";

export interface RunGridItem { key: string; label: string; tone: StatusTone; stateLabel: string; onSelect?: () => void }
const LEGEND: Array<[StatusTone, string]> = [["blue", "Running"], ["green", "Succeeded"], ["amber", "Waiting"], ["red", "Failed"], ["neutral", "No result"]];

/**
 * Airflow-style grid: one small square per run, coloured by its recorded result, oldest first. Each square
 * carries a text label and tooltip, and is a button when it can be opened; counts sit beside the legend so
 * colour is never the only signal.
 */
export function RunGrid({ label, items }: { label: string; items: RunGridItem[] }) {
  const counts = new Map<StatusTone, number>();
  for (const i of items) counts.set(i.tone, (counts.get(i.tone) ?? 0) + 1);
  return (
    <figure aria-label={label} className="run-grid">
      <ul>{items.map((item) => {
        const title = `${item.label}: ${item.stateLabel}`;
        return <li key={item.key}>{item.onSelect
          ? <button type="button" data-tone={item.tone} aria-label={title} title={title} onClick={item.onSelect} />
          : <span role="img" data-tone={item.tone} aria-label={title} title={title} />}</li>;
      })}</ul>
      <figcaption>{LEGEND.filter(([tone]) => counts.get(tone)).map(([tone, text]) => (
        <span key={tone} data-tone={tone}>{text} <b>{counts.get(tone)}</b></span>
      ))}</figcaption>
    </figure>
  );
}

/** Airflow run or task state in the desktop status palette. */
export function airflowTone(state: string | null | undefined): StatusTone {
  switch (state) {
    case "success": return "green";
    case "failed": case "upstream_failed": return "red";
    case "running": case "restarting": return "blue";
    case "queued": case "scheduled": case "up_for_retry": case "up_for_reschedule": case "deferred": case "skipped": return "amber";
    default: return "neutral";
  }
}
