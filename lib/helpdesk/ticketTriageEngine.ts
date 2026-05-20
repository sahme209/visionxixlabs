/**
 * Pure helpdesk ticket-triage + SLA tracker.
 *
 * Classifies incoming tickets into priority + suggested queue based on
 * keyword + tag heuristics, then checks every open ticket against its
 * per-priority SLA so the cockpit can surface breaches before they
 * blow customer trust.
 *
 * Pure / deterministic.
 */

export type TicketPriority = "p1" | "p2" | "p3" | "p4";
export type TicketQueue = "infra" | "security" | "billing" | "product" | "general";

export interface RawTicket {
  id: string;
  subject: string;
  body: string;
  tags: readonly string[];
  /** ISO timestamp the ticket was opened. */
  openedAtIso: string;
  /** ISO timestamp of last human reply, when applicable. */
  lastResponseAtIso: string | null;
  /** Closed iff non-null. */
  closedAtIso?: string | null;
}

export interface TriagedTicket {
  id: string;
  priority: TicketPriority;
  queue: TicketQueue;
  reason: string;
}

export interface TriageOptions {
  /** Per-priority SLA in hours. */
  slaHours?: Partial<Record<TicketPriority, number>>;
}

export interface SlaRow {
  ticketId: string;
  priority: TicketPriority;
  queue: TicketQueue;
  ageHours: number;
  hoursSinceLastResponse: number | null;
  slaHours: number;
  status: "within_sla" | "approaching_sla" | "breached" | "closed";
}

export interface TriageReport {
  triaged: TriagedTicket[];
  sla: SlaRow[];
  breachedCount: number;
  approachingCount: number;
}

const DEFAULT_SLA: Record<TicketPriority, number> = {
  p1: 1,        // 1h response
  p2: 4,
  p3: 24,
  p4: 72,
};

const HOUR_MS = 60 * 60 * 1000;

function detectPriority(t: RawTicket): { priority: TicketPriority; reason: string } {
  const blob = `${t.subject}\n${t.body}\n${t.tags.join(" ")}`.toLowerCase();
  if (/\b(outage|down|p1|incident|breach|cannot login|paying customer)\b/.test(blob)) {
    return { priority: "p1", reason: "p1 keyword match (outage/breach/cannot login)" };
  }
  if (/\b(error|broken|failed|stuck|urgent|asap)\b/.test(blob)) {
    return { priority: "p2", reason: "p2 keyword match (error/broken/urgent)" };
  }
  if (/\b(question|how|why|where|feature request)\b/.test(blob)) {
    return { priority: "p4", reason: "low-priority question / feature request" };
  }
  return { priority: "p3", reason: "default p3 (no priority signal found)" };
}

function detectQueue(t: RawTicket): TicketQueue {
  const blob = `${t.subject}\n${t.body}\n${t.tags.join(" ")}`.toLowerCase();
  if (/\b(aws|azure|gcp|kubernetes|k8s|terraform|server|database|prod)\b/.test(blob)) return "infra";
  if (/\b(security|breach|leak|password|token|cve|vuln)\b/.test(blob)) return "security";
  if (/\b(invoice|billing|refund|charge|payment|stripe)\b/.test(blob)) return "billing";
  if (/\b(feature|ui|button|dashboard|export|workflow)\b/.test(blob)) return "product";
  return "general";
}

export function triageTickets(input: {
  tickets: readonly RawTicket[];
  options?: TriageOptions;
  nowIso?: string;
}): TriageReport {
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const sla = { ...DEFAULT_SLA, ...(input.options?.slaHours ?? {}) };

  const triaged: TriagedTicket[] = [];
  const slaRows: SlaRow[] = [];
  let breached = 0;
  let approaching = 0;

  for (const t of input.tickets) {
    const { priority, reason } = detectPriority(t);
    const queue = detectQueue(t);
    triaged.push({ id: t.id, priority, queue, reason });

    const opened = new Date(t.openedAtIso).getTime();
    const ageHours = Math.max(0, (now.getTime() - opened) / HOUR_MS);
    const hoursSinceLastResponse = t.lastResponseAtIso
      ? Math.max(0, (now.getTime() - new Date(t.lastResponseAtIso).getTime()) / HOUR_MS)
      : null;
    const slaHours = sla[priority] ?? DEFAULT_SLA[priority];

    let status: SlaRow["status"];
    if (t.closedAtIso) {
      status = "closed";
    } else if (ageHours > slaHours) {
      status = "breached";
      breached += 1;
    } else if (ageHours >= slaHours * 0.8) {
      status = "approaching_sla";
      approaching += 1;
    } else {
      status = "within_sla";
    }

    slaRows.push({
      ticketId: t.id,
      priority,
      queue,
      ageHours: Math.round(ageHours * 10) / 10,
      hoursSinceLastResponse: hoursSinceLastResponse === null ? null : Math.round(hoursSinceLastResponse * 10) / 10,
      slaHours,
      status,
    });
  }

  slaRows.sort((a, b) => {
    const rank: Record<SlaRow["status"], number> = { breached: 0, approaching_sla: 1, within_sla: 2, closed: 3 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return b.ageHours - a.ageHours;
  });

  return { triaged, sla: slaRows, breachedCount: breached, approachingCount: approaching };
}
