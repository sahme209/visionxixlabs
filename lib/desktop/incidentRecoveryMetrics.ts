/** Recovery metrics from loaded incident records only (MTTM/MTTR-style medians). Pure; no clock. */
export interface IncidentTimes { status: string; reportedAt: string; mitigatedAt: string | null; resolvedAt: string | null }
export interface RecoveryMetrics { open: number; mitigate: { medianSeconds: number | null; count: number }; resolve: { medianSeconds: number | null; count: number } }

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}
function seconds(from: string, to: string | null): number | null {
  if (!to) return null;
  const a = Date.parse(from), b = Date.parse(to);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? (b - a) / 1000 : null;
}

export function incidentRecoveryMetrics(incidents: readonly IncidentTimes[]): RecoveryMetrics {
  const mitigate = incidents.map((i) => seconds(i.reportedAt, i.mitigatedAt)).filter((v): v is number => v !== null);
  const resolve = incidents.map((i) => seconds(i.reportedAt, i.resolvedAt)).filter((v): v is number => v !== null);
  return {
    open: incidents.filter((i) => i.status === "open").length,
    mitigate: { medianSeconds: median(mitigate), count: mitigate.length },
    resolve: { medianSeconds: median(resolve), count: resolve.length },
  };
}
