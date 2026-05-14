/**
 * In-process event bus for the operational event stream.
 *
 * This is the transport canonical subscribers (audit log, memory timeline,
 * command-center stream, copilot) attach to. The bus itself is intentionally
 * minimal — it's a typed pub/sub with backpressure-free fan-out. Durable
 * persistence is layered above via a subscriber that writes to the audit
 * store.
 *
 * Why a custom bus vs EventEmitter: typed event payloads (the discriminated
 * union in eventTypes.ts) require richer types than `EventEmitter` offers,
 * and we want explicit handling of subscriber errors so a buggy listener
 * can't break the pipeline for the rest.
 */

import type { AxiomEvent, AxiomEventKind, EventOf } from "./eventTypes";
import { newCorrelationId } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export type EventSubscriber = (event: AxiomEvent) => void | Promise<void>;
export type KindedSubscriber<K extends AxiomEventKind> = (event: EventOf<K>) => void | Promise<void>;

export interface EventBus {
  publish(event: AxiomEvent): Promise<void>;
  subscribe(handler: EventSubscriber): () => void;
  subscribeTo<K extends AxiomEventKind>(kind: K, handler: KindedSubscriber<K>): () => void;
}

class InProcessEventBus implements EventBus {
  private all: Set<EventSubscriber> = new Set();
  private kinded: Map<AxiomEventKind, Set<EventSubscriber>> = new Map();

  async publish(event: AxiomEvent): Promise<void> {
    // Fan-out: deliver to all-kind subscribers first, then kind-specific ones.
    // Subscriber errors are isolated so a single bad listener can't break the chain.
    const fanout = [
      ...Array.from(this.all),
      ...Array.from(this.kinded.get(event.kind) ?? []),
    ];
    await Promise.all(
      fanout.map(async (handler) => {
        try {
          await handler(event);
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[eventBus] subscriber failed", { kind: event.kind, err });
          }
        }
      })
    );
  }

  subscribe(handler: EventSubscriber): () => void {
    this.all.add(handler);
    return () => this.all.delete(handler);
  }

  subscribeTo<K extends AxiomEventKind>(kind: K, handler: KindedSubscriber<K>): () => void {
    let set = this.kinded.get(kind);
    if (!set) {
      set = new Set();
      this.kinded.set(kind, set);
    }
    // Safe cast: kinded set is partitioned by kind, so the handler signature
    // is consistent with what we'll dispatch to it.
    set.add(handler as EventSubscriber);
    return () => set!.delete(handler as EventSubscriber);
  }
}

let _bus: EventBus | null = null;

/** Lazily-instantiated process-wide event bus. */
export function getEventBus(): EventBus {
  if (!_bus) _bus = new InProcessEventBus();
  return _bus;
}

/** Replace the global bus — test seam only. */
export function __setEventBusForTest(bus: EventBus): void {
  _bus = bus;
}

// ---------------------------------------------------------------------------
// Envelope helpers
// ---------------------------------------------------------------------------

let _seq = 0;
function newEventId(): string {
  _seq = (_seq + 1) % 1_000_000;
  return `evt_${Date.now().toString(36)}_${_seq.toString(36).padStart(4, "0")}`;
}

/**
 * Compose a base envelope. Caller adds the discriminated payload fields.
 */
export interface EnvelopeInit {
  organizationId: AxiomEvent["organizationId"];
  actor: AxiomEvent["actor"];
  source: AxiomEvent["source"];
  correlationId?: CorrelationId;
  causationId?: AxiomEvent["causationId"];
  occurredAt?: string;
}

export function envelope(init: EnvelopeInit) {
  return {
    id: newEventId(),
    organizationId: init.organizationId,
    actor: init.actor,
    source: init.source,
    correlationId: init.correlationId ?? newCorrelationId(),
    causationId: init.causationId,
    occurredAt: init.occurredAt ?? new Date().toISOString(),
  };
}
