/**
 * Pure DNS sanity checker.
 *
 * Given a list of declared DNS records vs. observed live records,
 * flag mismatches, missing entries (declared but not live), and
 * orphans (live but not declared). Pure / deterministic.
 *
 * No network — caller passes both sets as fixtures.
 */

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";

export interface DnsRecord {
  name: string;                    // e.g. "axiom.app"
  type: DnsRecordType;
  value: string;                   // record-type-specific value
  /** Optional TTL — when both sides supply it, mismatch reported as warning. */
  ttl?: number;
}

export interface DnsFinding {
  name: string;
  type: DnsRecordType;
  kind: "missing" | "orphan" | "value_mismatch" | "ttl_mismatch";
  expected?: string;
  observed?: string;
}

export interface DnsSanityReport {
  findings: DnsFinding[];
  declaredCount: number;
  observedCount: number;
  /** Severity ladder. */
  severity: "ok" | "low" | "medium" | "high";
}

const keyOf = (name: string, type: DnsRecordType): string => `${name.toLowerCase()}::${type}`;

const rankSeverity = (findings: readonly DnsFinding[]): DnsSanityReport["severity"] => {
  const breaking = findings.filter((f) => f.kind === "missing" || f.kind === "value_mismatch").length;
  if (breaking >= 3) return "high";
  if (breaking >= 1) return "medium";
  if (findings.length > 0) return "low";
  return "ok";
};

export function checkDnsSanity(input: {
  declared: readonly DnsRecord[];
  observed: readonly DnsRecord[];
}): DnsSanityReport {
  const declaredByKey = new Map<string, DnsRecord>();
  const observedByKey = new Map<string, DnsRecord>();
  for (const r of input.declared) declaredByKey.set(keyOf(r.name, r.type), r);
  for (const r of input.observed) observedByKey.set(keyOf(r.name, r.type), r);

  const findings: DnsFinding[] = [];

  // Missing or value mismatch.
  for (const [k, d] of declaredByKey) {
    const o = observedByKey.get(k);
    if (!o) {
      findings.push({ name: d.name, type: d.type, kind: "missing", expected: d.value });
      continue;
    }
    if (d.value !== o.value) {
      findings.push({ name: d.name, type: d.type, kind: "value_mismatch", expected: d.value, observed: o.value });
    } else if (typeof d.ttl === "number" && typeof o.ttl === "number" && d.ttl !== o.ttl) {
      findings.push({
        name: d.name, type: d.type, kind: "ttl_mismatch",
        expected: String(d.ttl), observed: String(o.ttl),
      });
    }
  }

  // Orphan (observed but not declared).
  for (const [k, o] of observedByKey) {
    if (!declaredByKey.has(k)) {
      findings.push({ name: o.name, type: o.type, kind: "orphan", observed: o.value });
    }
  }

  findings.sort((a, b) => {
    const order = ["missing", "value_mismatch", "ttl_mismatch", "orphan"];
    const ai = order.indexOf(a.kind), bi = order.indexOf(b.kind);
    if (ai !== bi) return ai - bi;
    return a.name < b.name ? -1 : 1;
  });

  return {
    findings,
    declaredCount: declaredByKey.size,
    observedCount: observedByKey.size,
    severity: rankSeverity(findings),
  };
}
