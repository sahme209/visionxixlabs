import {useEffect, useRef, useState} from "react";
import {desktopClient} from "../lib/desktopClient";

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
    {events && events.length > 0 && <ol aria-label={`Recorded ${subject} events`} className="recorded-release-events space-y-1 text-xs text-zinc-400">
      {events.map(event => <li key={event.type}>
        <span>{labels[event.type]}</span><span className="recorded-release-event-separator" aria-hidden="true"> · </span><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>
      </li>)}
    </ol>}
  </div>;
}
