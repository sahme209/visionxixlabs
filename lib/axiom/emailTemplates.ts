/**
 * Phase 8: Executive email report templates.
 */

export type ExecutiveSummaryEmailParams = {
  infrastructureScore: number | null;
  savingsDelta: number | null;
  riskDelta: string | null;
  driftDetected: boolean;
  topAction: string;
};

export function executiveSummaryEmail(params: ExecutiveSummaryEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { infrastructureScore, savingsDelta, riskDelta, driftDetected, topAction } = params;

  const subject = driftDetected
    ? "Axiom: Infrastructure Drift Detected"
    : `Axiom: Infrastructure Score ${infrastructureScore ?? "—"}/100`;

  const html = [
    "<h2>Axiom Executive Summary</h2>",
    `<p><strong>Infrastructure Score:</strong> ${infrastructureScore ?? "—"}/100</p>`,
    savingsDelta != null ? `<p><strong>Savings Delta:</strong> $${savingsDelta.toLocaleString()}</p>` : "",
    riskDelta ? `<p><strong>Risk Change:</strong> ${riskDelta}</p>` : "",
    driftDetected ? "<p><strong>Drift detected.</strong> Review recommended.</p>" : "",
    `<p><strong>Top Action:</strong> ${topAction}</p>`,
    "<p><em>View full report in your Axiom dashboard.</em></p>",
  ]
    .filter(Boolean)
    .join("\n");

  const text = [
    "Axiom Executive Summary",
    "",
    `Infrastructure Score: ${infrastructureScore ?? "—"}/100`,
    savingsDelta != null ? `Savings Delta: $${savingsDelta.toLocaleString()}` : "",
    riskDelta ? `Risk Change: ${riskDelta}` : "",
    driftDetected ? "Drift detected. Review recommended." : "",
    "",
    `Top Action: ${topAction}`,
    "",
    "View full report in your Axiom dashboard.",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
