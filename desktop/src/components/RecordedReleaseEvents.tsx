import {useEffect, useRef, useState} from "react";
import {desktopClient} from "../lib/desktopClient";
import {formatRunElapsed} from "./DeploymentWorkflowEvidence";
import {motion} from "framer-motion";
import {useAllowMotion} from "./motion/useAllowMotion";

type RecordedEvent<EventType extends string> = {type: EventType; at: string};

export function RecordedReleaseEvents<EventType extends string>({subject, labels, read, onEvents}: {
  subject: string;
  labels: Record<EventType, string>;
  onEvents?: (events: readonly RecordedEvent<EventType>[] | undefined) => void;
  read: (signal: AbortSignal) => Promise<{ok: true; data: {events: RecordedEvent<EventType>[]}} | {ok: false}>;
}) {
  const owner = useRef({config: desktopClient.config, revision: desktopClient.getContextRevision()}).current;
  const flight = useRef<AbortController | null>(null);
  const [events, setEvents] = useState<RecordedEvent<EventType>[] | null>();
  const [loading, setLoading] = useState(false);
  const motionOk = useAllowMotion();
  useEffect(() => () => flight.current?.abort(), []);

  async function load() {
    if (flight.current || owner.config !== desktopClient.config || owner.revision !== desktopClient.getContextRevision()) return;
    const controller = new AbortController();
    flight.current = controller;
    setLoading(true);
    setEvents(undefined);
    onEvents?.(undefined);
    let next: RecordedEvent<EventType>[] | null = null;
    try {
      const result = await read(controller.signal);
      if (result.ok) next = result.data.events;
    } catch {
      // A rejected read is unavailable, just like a refused response.
    } finally {
      flight.current = null;
      if (!controller.signal.aborted && owner.config === desktopClient.config && owner.revision === desktopClient.getContextRevision()) {
        setLoading(false);
        setEvents(next);
        onEvents?.(next ?? undefined);
      }
    }
  }
  return <div className="space-y-2">
    <button type="button" className="btn-secondary" aria-disabled={loading} onClick={() => void load()}>
      {events ? `Refresh ${subject} history` : `Load ${subject} history`}
    </button>
    {loading && <p role="status">Loading {subject} history…</p>}
    {events === null && <p role="alert">Could not verify {subject} history.</p>}
    {events?.length === 0 && <p role="status">No {subject} events were recorded for this plan.</p>}
    {events && events.length > 0 && (() => {
      const first = validDate(events[0].at);
      const last = validDate(events[events.length - 1].at);
      const span = first && last && events.length > 1 ? formatRunElapsed(first, last) : null;
      return <>
        {span && <p className="recorded-release-events-span text-[11px] text-zinc-500">{events.length} recorded steps over {span}</p>}
        <ol aria-label={`Recorded ${subject} events`} className="recorded-release-events space-y-1 text-xs text-zinc-400">
          {events.map((event, index) => {
            const at = validDate(event.at);
            const elapsed = index > 0 && first && at ? formatRunElapsed(first, at) : null;
            const next = index < events.length - 1 ? validDate(events[index + 1].at) : null;
            const totalMs = first && last ? last.getTime() - first.getTime() : 0;
            const share = at && next && totalMs > 0 ? Math.max(0.02, (next.getTime() - at.getTime()) / totalMs) : 0;
            return <motion.li key={event.type} data-last={index === events.length - 1 ? "true" : undefined}
              initial={motionOk ? {opacity: 0, x: -6} : false} animate={{opacity: 1, x: 0}} transition={{duration: 0.35, delay: index * 0.07, ease: [0.22, 1, 0.36, 1]}}>
              <span>{labels[event.type]}</span><span className="recorded-release-event-separator" aria-hidden="true"> · </span><time dateTime={event.at}>{at ? at.toLocaleString() : event.at}</time>{elapsed && <span className="recorded-release-event-elapsed">+{elapsed}</span>}
              {share > 0 && <span className="recorded-release-event-duration" aria-hidden="true"><motion.span initial={motionOk ? {scaleX: 0} : false} animate={{scaleX: 1}} transition={{duration: 0.6, delay: 0.2 + index * 0.07}} style={{width: `${Math.min(100, share * 100)}%`}}/></span>}
            </motion.li>;
          })}
        </ol>
      </>;
    })()}
  </div>;
}

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
