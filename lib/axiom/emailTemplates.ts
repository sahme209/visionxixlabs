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

export type CriticalFindingsEmailParams = {
  leadName?: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  topFindings: Array<{ type: string; severity: string; detail: string }>;
};

export function criticalFindingsEmail(params: CriticalFindingsEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { leadName, findingsCount, criticalCount, highCount, topFindings } = params;

  const subject =
    criticalCount > 0 ? "Axiom: Critical Security Findings Detected" : "Axiom: Security Findings Require Review";

  const findingsList = topFindings
    .slice(0, 10)
    .map((f) => `<li><strong>${f.type}</strong> (${f.severity}): ${f.detail}</li>`)
    .join("\n");

  const html = [
    "<h2>Axiom Security Alert</h2>",
    leadName ? `<p>Hi ${leadName},</p>` : "",
    "<p>Your scheduled environment scan found security findings that require your attention.</p>",
    `<p><strong>Total findings:</strong> ${findingsCount} (Critical: ${criticalCount}, High: ${highCount})</p>`,
    topFindings.length > 0
      ? `<p><strong>Top findings:</strong></p><ul>${findingsList}</ul>`
      : "",
    "<p>Log in to your Axiom Cloud Operator dashboard to review and remediate.</p>",
    "<p><em>Axiom Environment Monitoring</em></p>",
  ]
    .filter(Boolean)
    .join("\n");

  const textLines = [
    "Axiom Security Alert",
    "",
    "Your scheduled environment scan found security findings.",
    `Total: ${findingsCount} (Critical: ${criticalCount}, High: ${highCount})`,
    "",
    ...topFindings.slice(0, 5).map((f) => `- ${f.type} (${f.severity}): ${f.detail}`),
    "",
    "Log in to your Axiom dashboard to review.",
  ];

  return { subject, html, text: textLines.join("\n") };
}
