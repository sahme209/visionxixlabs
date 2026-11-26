import { AlertTriangle, Archive, CheckCircle2, CircleDot, Clock3, PencilLine, PlayCircle, XCircle, type LucideIcon } from "lucide-react";

/** Tone means a recorded state, never a guess: blue in progress, green recorded success, amber waiting/attention, red recorded failure. */
export type StatusTone = "blue" | "green" | "amber" | "red" | "neutral";
export type StatusShape = "running" | "success" | "failure" | "waiting" | "attention" | "draft" | "closed" | "dot";
const shapes: Record<StatusShape, LucideIcon> = {
  running: PlayCircle, success: CheckCircle2, failure: XCircle, waiting: Clock3, attention: AlertTriangle, draft: PencilLine, closed: Archive, dot: CircleDot,
};

export function StatusBadge({ tone, shape, children }: { tone: StatusTone; shape: StatusShape; children: React.ReactNode }) {
  const Icon = shapes[shape];
  return <span className="status-badge" data-tone={tone}><Icon size={13} aria-hidden="true" />{children}</span>;
}

export function StatusIconChip({ tone, shape, size = 14 }: { tone: StatusTone; shape: StatusShape; size?: number }) {
  const Icon = shapes[shape];
  return <span className="status-icon-chip" data-tone={tone} aria-hidden="true"><Icon size={size} /></span>;
}

/** Release request states. Submitted waits for review (amber); draft and closed are neutral because closing records no outcome by itself. */
export function releaseRequestTone(status: string): { tone: StatusTone; shape: StatusShape } {
  if (status === "submitted") return { tone: "amber", shape: "waiting" };
  if (status === "draft") return { tone: "neutral", shape: "draft" };
  if (status === "closed") return { tone: "neutral", shape: "closed" };
  return { tone: "neutral", shape: "dot" };
}

/** Recorded workflow run results. */
export function runResultTone(status: string, conclusion: string | null | undefined): { tone: StatusTone; shape: StatusShape } {
  if (conclusion === "success") return { tone: "green", shape: "success" };
  if (conclusion && ["failure", "cancelled", "timed_out", "startup_failure"].includes(conclusion)) return { tone: "red", shape: "failure" };
  if (["queued", "in_progress", "waiting", "pending", "requested"].includes(status)) return { tone: "blue", shape: "running" };
  return { tone: "neutral", shape: "dot" };
}
