/**
 * Pure SaaS inventory clusterer.
 *
 * Given a list of observed SaaS apps (from SSO/login signals), cluster
 * them into per-vendor groups, flag potential duplicates (Slack vs.
 * slack.com), and compute per-vendor seat / spend rollups.
 *
 * Pure / deterministic. No DB.
 */

export interface SaasObservation {
  appLabel: string;        // raw label from the SSO feed
  domain: string;          // login domain (e.g. "slack.com")
  seats: number;
  monthlySpendUSD: number;
}

export interface SaasClusterRow {
  vendorKey: string;       // normalized vendor (e.g. "slack")
  labels: string[];        // distinct raw labels merged into this cluster
  domains: string[];
  totalSeats: number;
  totalMonthlySpend: number;
  /** True when more than one distinct (label OR domain) feeds this vendor. */
  potentialDuplicate: boolean;
}

export interface SaasClusterReport {
  totalObservations: number;
  totalVendors: number;
  totalSeats: number;
  totalMonthlySpend: number;
  clusters: SaasClusterRow[];
  duplicateGroups: SaasClusterRow[];
}

const normalizeKey = (s: string): string => s.toLowerCase().replace(/^https?:\/\//, "").replace(/\.com$/, "").replace(/[^a-z0-9]+/g, "");

export function clusterSaasInventory(observations: readonly SaasObservation[]): SaasClusterReport {
  const buckets = new Map<string, SaasClusterRow>();
  let totalSeats = 0;
  let totalSpend = 0;

  for (const o of observations) {
    // Prefer the domain-derived key when present, else fall back to the label.
    const fromDomain = normalizeKey(o.domain);
    const fromLabel = normalizeKey(o.appLabel);
    // Use whichever is shorter (more "stem-like") as the vendor key.
    const vendorKey = fromDomain.length > 0 && (fromDomain.length <= fromLabel.length || fromLabel.length === 0)
      ? fromDomain
      : fromLabel || "unknown";

    const row = buckets.get(vendorKey) ?? {
      vendorKey,
      labels: [],
      domains: [],
      totalSeats: 0,
      totalMonthlySpend: 0,
      potentialDuplicate: false,
    };
    if (!row.labels.includes(o.appLabel)) row.labels.push(o.appLabel);
    if (o.domain.length > 0 && !row.domains.includes(o.domain)) row.domains.push(o.domain);
    row.totalSeats += Math.max(0, o.seats);
    row.totalMonthlySpend += Math.max(0, o.monthlySpendUSD);
    buckets.set(vendorKey, row);
    totalSeats += Math.max(0, o.seats);
    totalSpend += Math.max(0, o.monthlySpendUSD);
  }

  for (const row of buckets.values()) {
    row.potentialDuplicate = row.labels.length > 1 || row.domains.length > 1;
    row.labels.sort();
    row.domains.sort();
  }

  const clusters = [...buckets.values()].sort((a, b) => b.totalMonthlySpend - a.totalMonthlySpend);
  const duplicateGroups = clusters.filter((c) => c.potentialDuplicate);

  return {
    totalObservations: observations.length,
    totalVendors: buckets.size,
    totalSeats,
    totalMonthlySpend: totalSpend,
    clusters,
    duplicateGroups,
  };
}
