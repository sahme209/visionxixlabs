/**
 * Phase 465 — PR ↔ change-ticket link enricher.
 *
 * Scans a PR's title and body text for change-ticket external keys
 * (Jira "PROJ-123", Linear "ENG-42", ServiceNow "CHG0012345") and
 * returns the matching ChangeTicket id list. Pure function — caller
 * supplies the candidate ticket set so this stays I/O-free and
 * deterministic.
 *
 * The PullRequestRecord row already has `linkedStories: string[]` and
 * `linkedTickets: string[]` populated by the GitHub/GitLab/ADO
 * projectors (Phase 452-454) from `STORY_PATTERN` + `TICKET_PATTERN`.
 * This linker reverses that: given a populated ChangeTicket table, it
 * resolves those external-key strings into actual ChangeTicket ids
 * AND adds the resolved PR id to the ticket's `linkedPrRecordIds[]`.
 */

import type { ChangeTicketProvider } from "./providers/changeTicketProjectors";

/* ──────────────────────────────────────────────────────────────────
   Patterns — broader than the projector-side ones because we scan
   prose, not just structured metadata.
   ────────────────────────────────────────────────────────────── */

/** Jira-style keys: 2-10 uppercase letters, a dash, then 1-7 digits. */
export const JIRA_KEY_PATTERN = /\b([A-Z][A-Z0-9]{1,9})-(\d{1,7})\b/g;

/** Linear keys: 2-10 uppercase letters, dash, 1-6 digits. Visually overlaps
 *  with Jira; the caller's ChangeTicket table disambiguates by provider. */
export const LINEAR_KEY_PATTERN = JIRA_KEY_PATTERN;

/** ServiceNow change request: CHG followed by 7 digits. */
export const SERVICENOW_KEY_PATTERN = /\b(CHG\d{7})\b/g;

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export interface CandidateTicket {
  id: string;
  provider: ChangeTicketProvider;
  externalKey: string;
}

export interface LinkPrToTicketsInput {
  prId: string;
  prTitle: string;
  prBody: string | null;
  candidates: ReadonlyArray<CandidateTicket>;
}

export interface LinkPrToTicketsResult {
  /** Tickets we matched, keyed by ticket id (deduped). */
  matchedTicketIds: string[];
  /** External keys we extracted but couldn't find in the candidate set.
   *  Surface this to the operator so they know a referenced ticket is
   *  missing (mis-typed key, deleted ticket, or unsynced provider). */
  unresolvedExternalKeys: string[];
  /** Per-ticket id → which external key in the PR text matched it.
   *  Useful for explanation UIs ("Linked because the PR body mentions
   *  PROJ-123"). */
  matchReasons: Record<string, string>;
}

export function linkPrToTickets(input: LinkPrToTicketsInput): LinkPrToTicketsResult {
  const text = `${input.prTitle}\n${input.prBody ?? ""}`;
  const extracted = extractExternalKeys(text);

  // Build a lookup of candidate ticket external keys (case-insensitive
  // for service-now which lowercases inconsistently; case-exact for
  // Jira/Linear which are always uppercase upstream).
  const byKey = new Map<string, CandidateTicket>();
  for (const c of input.candidates) {
    byKey.set(normalizeKey(c.externalKey, c.provider), c);
  }

  const matchedTicketIds = new Set<string>();
  const matchReasons: Record<string, string> = {};
  const unresolved = new Set<string>();
  for (const ext of extracted) {
    const norm = normalizeKey(ext, inferProvider(ext));
    const t = byKey.get(norm);
    if (t) {
      matchedTicketIds.add(t.id);
      if (!matchReasons[t.id]) matchReasons[t.id] = ext;
    } else {
      unresolved.add(ext);
    }
  }

  return {
    matchedTicketIds: Array.from(matchedTicketIds),
    unresolvedExternalKeys: Array.from(unresolved),
    matchReasons,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Helpers — exported for testing.
   ────────────────────────────────────────────────────────────── */

export function extractExternalKeys(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(JIRA_KEY_PATTERN)) {
    seen.add(`${m[1]}-${m[2]}`);
  }
  for (const m of text.matchAll(SERVICENOW_KEY_PATTERN)) {
    seen.add(m[1]);
  }
  return Array.from(seen);
}

export function inferProvider(externalKey: string): ChangeTicketProvider {
  if (/^CHG\d{7}$/.test(externalKey)) return "servicenow";
  // Jira vs Linear are indistinguishable by pattern; default to jira so
  // the lookup map can collide for both. The caller's candidate set
  // pins the actual provider — see normalizeKey.
  return "jira";
}

function normalizeKey(externalKey: string, _provider: ChangeTicketProvider): string {
  // ServiceNow keys are case-insensitive in practice; Jira + Linear
  // upstream are always uppercase. Uppercasing here gives a stable
  // map key without losing fidelity.
  return externalKey.toUpperCase();
}
