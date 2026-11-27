'use client';
import { TONE_DOT, TONE_TEXT, toneFor, stateLabel, type StatusTone } from '@/lib/cockpit/statusTone';

export interface StateGridItem { key: string; label: string; state: string | null; onSelect?: () => void }
const LEGEND: Array<[StatusTone, string]> = [['running', 'Running'], ['success', 'Succeeded'], ['attention', 'Queued, retrying or skipped'], ['failed', 'Failed'], ['idle', 'No status']];

/**
 * Airflow-style grid: one small square per run or task, coloured by state, newest last. Each square has a
 * text label for screen readers and a tooltip; when it is selectable it is a button. Counts per state sit
 * beside the legend so colour is never the only signal.
 */
export function StateGrid({ label, items, square = 14 }: { label: string; items: StateGridItem[]; square?: number }) {
  const counts = new Map<StatusTone, number>();
  for (const i of items) counts.set(toneFor(i.state), (counts.get(toneFor(i.state)) ?? 0) + 1);
  return (
    <figure aria-label={label} className="mt-5">
      <ul className="flex flex-wrap gap-1">{items.map((item) => {
        const tone = toneFor(item.state);
        const title = `${item.label}: ${stateLabel(item.state ?? 'none')}`;
        const cls = `block rounded-[3px] ${TONE_DOT[tone]} ${item.onSelect ? 'cursor-pointer outline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white' : ''}`;
        return <li key={item.key}>{item.onSelect
          ? <button type="button" aria-label={title} title={title} onClick={item.onSelect} className={cls} style={{ width: square, height: square }} />
          : <span role="img" aria-label={title} title={title} className={cls} style={{ width: square, height: square }} />}</li>;
      })}</ul>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">{LEGEND.filter(([tone]) => counts.get(tone)).map(([tone, text]) => (
        <span key={tone} className={`inline-flex items-center gap-1.5 ${TONE_TEXT[tone]}`}><span aria-hidden className={`h-2 w-2 rounded-[2px] ${TONE_DOT[tone]}`} />{text} <span className="tabular-nums text-zinc-300">{counts.get(tone)}</span></span>
      ))}</figcaption>
    </figure>
  );
}
