import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const APPLICATION_HTTP_CASE = "actual local Next HTTP authenticates, reads versioned allowance, denies unsupported operations and releases provider-disabled hold";
const CHECKOUT_HTTP_CASE = "actual owned pricing HTTP checkout and signed webhook compose existing TEST service in a separate synthetic worker";
const HTTP_CASES = new Set([
  APPLICATION_HTTP_CASE,
  CHECKOUT_HTTP_CASE,
]);

/** @param {unknown} report @param {number} passedCount @param {number} skippedCount */
function executedRows(report, passedCount, skippedCount) {
  const fail = () => { throw new Error("owned_pg_evidence_incomplete"); };
  if (!report || typeof report !== "object") return fail();
  if (report.success !== true || report.numTotalTests !== 34 || report.numPassedTests !== passedCount
    || report.numFailedTests !== 0 || report.numPendingTests !== skippedCount || report.numFailedTestSuites !== 0
    || !Array.isArray(report.testResults) || report.testResults.length !== 1) return fail();
  const suite = report.testResults[0];
  if (suite?.status !== "passed" || typeof suite.name !== "string"
    || !suite.name.replaceAll("\\", "/").endsWith("/lib/billing/__tests__/newTestSubscriptionService.postgres.test.ts")
    || !Array.isArray(suite.assertionResults) || suite.assertionResults.length !== 34) return fail();
  const rows = suite.assertionResults;
  if (rows.some(row => !row || typeof row.title !== "string")) return fail();
  const passed = rows.filter(row => row.status === "passed");
  // Vitest aggregates skips under numPendingTests; rows use "skipped".
  const skipped = rows.filter(row => row.status === "skipped");
  if (passed.length !== passedCount || skipped.length !== skippedCount || new Set(rows.map(row => row.title)).size !== 34) return fail();
  return { passed, skipped };
}

/** Require SQL execution independently of the separately filtered HTTP job.
 * No report content is echoed. @param {unknown} report */
export function checkOwnedCommercialAcceptance(report) {
  const { passed, skipped } = executedRows(report, 32, 2);
  if (skipped.some(row => !HTTP_CASES.has(row.title))
    || passed.filter(row => row.title.startsWith("legacy real PG ")).length !== 6
    || passed.filter(row => row.title.startsWith("V2 ")).length !== 19) throw new Error("owned_pg_evidence_incomplete");
  return { schemaVersion: 1, evidenceScope: "owned_postgres_synthetic_provider", sqlCasesPassed: 32,
    legacyAdmissionCasesPassed: 6, allocationCasesPassed: 19, httpCasesSkipped: 2,
    hostedPaymentVerified: false, productionChanges: false };
}

/** Filtered actual application HTTP test; not a hosted payment or signup claim.
 * The separate SQL job remains mandatory. @param {unknown} report */
export function checkOwnedApplicationHttpAcceptance(report) {
  const { passed, skipped } = executedRows(report, 1, 33);
  if (passed[0].title !== APPLICATION_HTTP_CASE || !skipped.some(row => row.title === CHECKOUT_HTTP_CASE)) throw new Error("owned_pg_evidence_incomplete");
  return { schemaVersion: 1, evidenceScope: "owned_application_http_synthetic_provider", applicationHttpCasesPassed: 1,
    sqlCasesSkipped: 32, checkoutWorkerCaseSkipped: true, hostedPaymentVerified: false, productionChanges: false };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const mode = process.argv[3] ?? "sql";
    if (mode !== "sql" && mode !== "http") throw new Error("unsupported_mode");
    const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
    console.log(JSON.stringify(mode === "http" ? checkOwnedApplicationHttpAcceptance(report) : checkOwnedCommercialAcceptance(report)));
  }
  catch { console.error("owned_pg_evidence_incomplete"); process.exitCode = 1; }
}
