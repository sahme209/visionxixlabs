/**
 * Route → help-entry index.
 *
 * Maps dashboard routes (or route prefixes) to the canonical
 * HelpEntry id, so the floating "?" bubble on every page can show
 * the right context block without each page wiring its own.
 *
 * Hard rules:
 *   - Longest-prefix match wins, so "/dashboard/runbooks/queue"
 *     resolves to the queue entry, not the parent runbooks entry.
 *   - If no prefix matches, returns undefined (the bubble shows a
 *     generic "browse all help" link instead of guessing).
 */

import { findHelpEntry, type HelpEntry } from "./helpKnowledgeBase";

const ROUTE_INDEX: Array<{ prefix: string; entryId: string }> = [
  // Operator
  { prefix: "/dashboard/command-center", entryId: "command-center" },
  { prefix: "/dashboard/agi",            entryId: "agi-cockpit" },
  { prefix: "/dashboard/autonomy",       entryId: "autonomy-cockpit" },

  // Providers
  { prefix: "/dashboard/aws-services",      entryId: "aws-services" },
  { prefix: "/dashboard/cloud-inventory",   entryId: "cloud-inventory" },
  { prefix: "/dashboard/network-topology",  entryId: "network-topology" },

  // Audit
  { prefix: "/dashboard/cloudtrail",        entryId: "cloudtrail" },

  // Cost
  { prefix: "/dashboard/cost-overview",     entryId: "cost-overview" },
  { prefix: "/dashboard/cost-explainer",    entryId: "cost-explainer" },

  // Security
  { prefix: "/dashboard/cloud-security",    entryId: "cloud-security" },

  // Containers
  { prefix: "/dashboard/k8s-eol",           entryId: "k8s-eol" },
  { prefix: "/dashboard/containers",        entryId: "containers" },

  // Autonomy
  { prefix: "/dashboard/charter",                  entryId: "charter" },
  { prefix: "/dashboard/runbooks/queue",           entryId: "runbook-queue" },
  { prefix: "/dashboard/runbooks",                 entryId: "runbooks" },
  { prefix: "/dashboard/policy-previews",          entryId: "policy-previews" },
  { prefix: "/dashboard/scp-simulator",            entryId: "scp-simulator" },

  // Notifications
  { prefix: "/dashboard/notifications-outbound",   entryId: "outbound-notifications" },

  // Setup
  { prefix: "/dashboard/setup",                    entryId: "setup" },
  { prefix: "/dashboard/integrations/health",      entryId: "integration-health" },
];

/** Resolve the most specific HelpEntry for a given pathname. */
export function resolveHelpForPath(pathname: string): HelpEntry | undefined {
  // Sort longest-prefix first so /runbooks/queue beats /runbooks.
  const matches = ROUTE_INDEX
    .filter((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  if (matches.length === 0) return undefined;
  return findHelpEntry(matches[0].entryId);
}
