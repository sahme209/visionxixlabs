/**
 * SSE event stream kernel — Phase 409.
 *
 * Pure, deterministic logic for the /api/v1/events/stream endpoint and
 * its desktop consumer. No I/O, no clocks (except where the caller
 * injects `now`). The IO boundary (the route handler) composes this
 * kernel with Prisma + setInterval.
 *
 * Closed-union safety:
 *   - `StreamEventKind` is the only event-name type the endpoint can
 *     emit and the client can subscribe to. A typo in either direction
 *     is a compile error, not a runtime "silently never delivers".
 *   - `parseEventFilter()` validates client subscriptions: unknown kinds
 *     get dropped (rather than silently widening the stream), and an
 *     empty list collapses to "every kind".
 */

export type StreamEventKind =
  | "heartbeat"
  | "approvals.snapshot"
  | "connectors.snapshot"
  | "stream.ready"
  | "stream.shutdown";

const ALL_KINDS: ReadonlyArray<StreamEventKind> = [
  "heartbeat",
  "approvals.snapshot",
  "connectors.snapshot",
  "stream.ready",
  "stream.shutdown",
];

/** True only when `s` is a recognized closed-union member. */
export function isStreamEventKind(s: string): s is StreamEventKind {
  return (ALL_KINDS as ReadonlyArray<string>).includes(s);
}

/**
 * The set of kinds the subscriber wants. `null` = wildcard (every
 * kind). An explicit allow-list means we never broadcast a kind the
 * subscriber didn't ask for — important for log-noise + bandwidth on
 * mobile / metered connections.
 */
export type EventFilter = ReadonlySet<StreamEventKind> | null;

/**
 * Parse the `?subscribe=` query string. Examples:
 *   ?subscribe=*                       → wildcard, every kind.
 *   ?subscribe=heartbeat               → just heartbeats (no-op stream).
 *   ?subscribe=approvals.snapshot,connectors.snapshot
 *                                      → both snapshot kinds.
 *
 * Bad inputs:
 *   - missing / empty                  → wildcard (so naive clients see
 *                                        the canonical behavior).
 *   - any unknown member               → dropped silently from the set;
 *                                        the rest still resolves.
 *   - "*"                              → wildcard.
 *   - "*,heartbeat"                    → wildcard (`*` wins).
 */
export function parseEventFilter(raw: string | null | undefined): EventFilter {
  if (!raw) return null;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.includes("*")) return null;
  const out = new Set<StreamEventKind>();
  for (const p of parts) {
    if (isStreamEventKind(p)) out.add(p);
  }
  // An entirely-invalid filter ("?subscribe=foo,bar") would otherwise
  // produce an empty set and the client would silently get NO events.
  // Treat that as wildcard so the client sees something rather than
  // hanging in confused silence. (The shouldEmit() unit tests pin this.)
  return out.size === 0 ? null : out;
}

/** Pure decision: does this filter want this event kind? */
export function shouldEmit(kind: StreamEventKind, filter: EventFilter): boolean {
  if (filter === null) return true;
  return filter.has(kind);
}

/**
 * Pure formatter for a single SSE frame. RFC 8895 / EventSource spec:
 *   event: <kind>\n
 *   data: <json>\n
 *   id: <id>\n             (optional, lets clients resume after reconnect)
 *   \n                     (terminating blank line)
 *
 * The cumulative result is the exact bytes the IO boundary
 * `controller.enqueue()`s onto the wire.
 */
export function formatSseFrame(args: {
  kind: StreamEventKind;
  data: unknown;
  /** Optional monotonic id used by the EventSource Last-Event-ID retry header. */
  id?: string | number;
}): string {
  const lines: string[] = [];
  lines.push(`event: ${args.kind}`);
  // JSON.stringify here, NOT in the route handler — keeps the frame
  // format inside the kernel so tests can assert on bytes.
  lines.push(`data: ${JSON.stringify(args.data)}`);
  if (args.id !== undefined) lines.push(`id: ${String(args.id)}`);
  lines.push(""); // terminator
  lines.push("");
  return lines.join("\n");
}

/**
 * Pure cadence policy: given the wall-clock seconds since the stream
 * opened, decide which snapshot kinds should fire on THIS tick.
 *
 * Why a kernel: the IO boundary is one `setInterval` running every 5s.
 * Within that, snapshots fire on different cadences (approvals every
 * 5s, connectors every 30s) and heartbeats every 25s to keep the
 * connection alive through any intermediate proxy. Putting that policy
 * here means the route handler is just a clock + dispatch.
 */
export interface TickPlan {
  emitApprovalsSnapshot: boolean;
  emitConnectorsSnapshot: boolean;
  emitHeartbeat: boolean;
}

export function planTick(secondsSinceOpen: number): TickPlan {
  return {
    emitApprovalsSnapshot:  secondsSinceOpen % 5  === 0,   // every 5s
    emitConnectorsSnapshot: secondsSinceOpen % 30 === 0,   // every 30s
    emitHeartbeat:          secondsSinceOpen % 25 === 0,   // every 25s
  };
}
