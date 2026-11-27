/**
 * Check library (parity: step templates). Pure, client-safe.
 *
 * Reviewed starting points for common deployment checks. Each GitHub Action entry is pinned to the
 * full commit of a published release, and its inputs are names that action declares at that commit.
 * Picking an entry only fills the Add a check form; nothing is saved until an admin adds the check.
 */
import { validateCheck, type CheckKind, type CheckStage } from "./deploymentChecks";

export type LibraryCategory = "Security" | "Infrastructure" | "Containers" | "Web quality" | "Release gates";

export interface LibraryEntry {
  id: string;
  category: LibraryCategory;
  summary: string;
  check: { key: string; name: string; kind: CheckKind; stage: CheckStage; mode: "blocking" | "advisory"; spec: Record<string, unknown> };
  /** Release the commit belongs to, and where to read the action's own documentation. */
  source?: { release: string; url: string; verifiedOn: string };
  /** Spec fields the user must change before adding (they hold example values). */
  edit?: string[];
}

const VERIFIED_ON = "2026-11-27";
const gh = (repo: string, release: string) => ({ release, url: `https://github.com/${repo}/releases/tag/${release}`, verifiedOn: VERIFIED_ON });

export const CHECK_LIBRARY: readonly LibraryEntry[] = [
  {
    id: "trivy-filesystem", category: "Security", summary: "Scans the repository's dependencies and files for known critical and high vulnerabilities with Trivy.",
    check: { key: "trivy-fs", name: "Trivy filesystem scan", kind: "marketplace_action", stage: "validate", mode: "blocking", spec: { action: "aquasecurity/trivy-action", commit: "ed142fd0673e97e23eac54620cfb913e5ce36c25", inputs: ["scan-type=fs", "scan-ref=.", "severity=CRITICAL,HIGH", "ignore-unfixed=true", "exit-code=1"] } },
    source: gh("aquasecurity/trivy-action", "v0.36.0"),
  },
  {
    id: "grype-filesystem", category: "Security", summary: "Scans the repository with Grype and fails on high or critical vulnerabilities.",
    check: { key: "grype-scan", name: "Grype vulnerability scan", kind: "marketplace_action", stage: "validate", mode: "advisory", spec: { action: "anchore/scan-action", commit: "11983a512817154c80a9db660c1a184be7513ed6", inputs: ["path=.", "fail-build=true", "severity-cutoff=high"] } },
    source: gh("anchore/scan-action", "v7.4.3"),
  },
  {
    id: "checkov-iac", category: "Infrastructure", summary: "Checks Terraform, CloudFormation, Kubernetes and other infrastructure files for misconfigurations with Checkov.",
    check: { key: "checkov-iac", name: "Checkov infrastructure scan", kind: "marketplace_action", stage: "validate", mode: "advisory", spec: { action: "bridgecrewio/checkov-action", commit: "99bb2caf247dfd9f03cf984373bc6043d4e32ebf", inputs: ["directory=.", "quiet=true"] } },
    source: gh("bridgecrewio/checkov-action", "v12.1347.0"),
  },
  {
    id: "hadolint-dockerfile", category: "Containers", summary: "Lints the Dockerfile with Hadolint and fails on errors.",
    check: { key: "hadolint", name: "Dockerfile lint", kind: "marketplace_action", stage: "validate", mode: "advisory", spec: { action: "hadolint/hadolint-action", commit: "06be81baf89a55ffd0e24b8f04a4185738dd3387", inputs: ["dockerfile=Dockerfile", "failure-threshold=error"] } },
    source: gh("hadolint/hadolint-action", "v3.5.0"), edit: ["inputs"],
  },
  {
    id: "zap-baseline", category: "Web quality", summary: "Runs the OWASP ZAP baseline scan against a deployed staging site. It only reads pages and does not attack them.",
    check: { key: "zap-baseline", name: "ZAP baseline scan", kind: "marketplace_action", stage: "verify", mode: "advisory", spec: { action: "zaproxy/action-baseline", commit: "de8ad967d3548d44ef623df22cf95c3b0baf8b25", inputs: ["target=https://staging.example.com", "allow_issue_writing=false"] } },
    source: gh("zaproxy/action-baseline", "v0.15.0"), edit: ["inputs"],
  },
  {
    id: "lighthouse", category: "Web quality", summary: "Measures performance and accessibility of a deployed page with Lighthouse CI. Results stay in the run.",
    check: { key: "lighthouse", name: "Lighthouse audit", kind: "marketplace_action", stage: "verify", mode: "advisory", spec: { action: "treosh/lighthouse-ci-action", commit: "3e7e23fb74242897f95c0ba9cabad3d0227b9b18", inputs: ["urls=https://staging.example.com", "uploadArtifacts=false", "temporaryPublicStorage=false"] } },
    source: gh("treosh/lighthouse-ci-action", "12.6.2"), edit: ["inputs"],
  },
  {
    id: "health-smoke", category: "Release gates", summary: "Fails the release if the health endpoint does not answer 200 within 1.5 seconds after deploy.",
    check: { key: "health-smoke", name: "Health endpoint smoke test", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://staging.example.com/health", expectStatus: 200, maxLatencyMs: 1500 } },
    edit: ["url"],
  },
  {
    id: "production-checklist", category: "Release gates", summary: "A person confirms the rollback plan, monitoring and on-call before a production release.",
    check: { key: "production-checklist", name: "Production change checklist", kind: "manual_checklist", stage: "approve", mode: "blocking", spec: { items: ["Rollback plan written and tested", "Dashboards and alerts checked for this change", "On-call engineer knows the release is going out", "Customer-facing changes announced or not needed"] } },
  },
  {
    id: "sbom-provenance", category: "Security", summary: "Requires an SBOM and SLSA provenance for the build before release.",
    check: { key: "sbom-provenance", name: "SBOM and provenance", kind: "supply_chain", stage: "validate", mode: "advisory", spec: { evidence: "sbom_and_provenance", verifier: "slsa-verifier" } },
  },
];

export const LIBRARY_CATEGORIES: readonly LibraryCategory[] = ["Security", "Infrastructure", "Containers", "Web quality", "Release gates"];

/** Entries whose check fails validation; empty when the library is sound (checked in tests). */
export function invalidLibraryEntries(entries: readonly LibraryEntry[] = CHECK_LIBRARY): string[] {
  return entries.filter((e) => !validateCheck(e.check).ok).map((e) => e.id);
}

/** Entries not yet in the workspace, matched by check key. */
export function libraryFor(existingKeys: ReadonlySet<string>, entries: readonly LibraryEntry[] = CHECK_LIBRARY): LibraryEntry[] {
  return entries.filter((e) => !existingKeys.has(e.check.key));
}
