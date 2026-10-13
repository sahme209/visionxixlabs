import { createHash } from "node:crypto";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
    .join(",")}}`;
}

export function agentActionDigest(input: {
  organizationId: string;
  conversationId: string;
  proposedByUserId: string;
  toolName: string;
  args: unknown;
}): string {
  return createHash("sha256").update(canonical(input)).digest("hex");
}

export function approvalExpiry(from = new Date(), ttlHours = 24): Date {
  return new Date(from.getTime() + ttlHours * 60 * 60 * 1000);
}
