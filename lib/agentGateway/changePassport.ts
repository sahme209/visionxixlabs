/**
 * Change passport (agentic automation priority 2). Pure.
 *
 * Every change an AI agent proposes carries a small, fixed record of where it came from: which agent,
 * which model (as requested or reported, never guessed), which tools it used, and the human who owns
 * it. It is stored with the change when the change is created and shown wherever the change is
 * reviewed, so nobody has to ask "who or what made this?". A digest lets the record be checked later.
 */
import { createHash } from "node:crypto";

export const PASSPORT_VERSION = 1;
export type PassportOrigin = "v19_agent" | "external_agent";
export interface ChangePassport {
  v: typeof PASSPORT_VERSION;
  origin: PassportOrigin;
  agent: string;
  /** Model the agent requested or reported; null when it did not say. */
  model: string | null;
  tools: string[];
  /** The person accountable for the change: the requester's user id for V19's Agent, the key creator's email for an external agent. */
  ownerUserId: string | null;
  createdAt: string;
  digest: string;
}

const TOOL = /^[A-Za-z0-9_.:\/-]{1,64}$/;
const clean = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() && v.trim().length <= max && !/[\u0000-\u001f]/.test(v) ? v.trim() : null);

export function normalizePassportTools(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 20 || !raw.every((t) => typeof t === "string" && TOOL.test(t))) return null;
  return [...new Set(raw as string[])];
}

export function buildChangePassport(input: { origin: PassportOrigin; agent: string; model?: unknown; tools?: readonly string[]; ownerUserId: string | null; createdAt: Date }): ChangePassport {
  const body = {
    v: PASSPORT_VERSION as typeof PASSPORT_VERSION,
    origin: input.origin,
    agent: clean(input.agent, 80) ?? "unnamed-agent",
    model: clean(input.model, 120),
    tools: [...new Set((input.tools ?? []).filter((t) => TOOL.test(t)))].slice(0, 20),
    ownerUserId: input.ownerUserId,
    createdAt: input.createdAt.toISOString(),
  };
  const digest = createHash("sha256").update(JSON.stringify([body.v, body.origin, body.agent, body.model, body.tools, body.ownerUserId, body.createdAt])).digest("hex");
  return { ...body, digest };
}

/** Reads a stored passport; null when absent (changes made before passports) or malformed. */
export function readChangePassport(value: unknown): ChangePassport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (p.v !== PASSPORT_VERSION || (p.origin !== "v19_agent" && p.origin !== "external_agent") || typeof p.agent !== "string" || typeof p.createdAt !== "string" || typeof p.digest !== "string") return null;
  const tools = normalizePassportTools(p.tools);
  if (!tools) return null;
  const rebuilt = buildChangePassport({ origin: p.origin, agent: p.agent, model: p.model, tools, ownerUserId: typeof p.ownerUserId === "string" ? p.ownerUserId : null, createdAt: new Date(p.createdAt) });
  return rebuilt.digest === p.digest ? rebuilt : null;
}

/** One plain line for review screens. */
export function passportLine(p: ChangePassport, names: (userId: string) => string | null = () => null): string {
  const who = p.origin === "v19_agent" ? `V19 Agent (${p.agent})` : p.agent;
  const owner = p.ownerUserId ? names(p.ownerUserId) ?? (p.ownerUserId.includes("@") ? p.ownerUserId : "a workspace member") : "no recorded owner";
  return `${who} · model ${p.model ?? "not reported"} · ${p.tools.length ? `tools ${p.tools.join(", ")}` : "no tools reported"} · owner ${owner}`;
}
