import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HTTP_CASES = new Set([
  "actual local Next HTTP authenticates, reads versioned allowance, denies unsupported operations and releases provider-disabled hold",
  "actual owned pricing HTTP checkout and signed webhook compose existing TEST service in a separate synthetic worker",
]);

/** Validate execution, not test declarations. This receipt deliberately grants
 * no hosted-payment or customer-journey acceptance. No report content is echoed.
 * @param {unknown} report
 */
export function checkOwnedCommercialAcceptance(report) {
  const fail = () => { throw new Error("owned_pg_evidence_incomplete"); };
  if (!report || typeof report !== "object") return fail();
  if (report.success !== true || report.numTotalTests !== 34 || report.numPassedTests !== 32
    || report.numFailedTests !== 0 || report.numPendingTests !== 2 || report.numFailedTestSuites !== 0
    || !Array.isArray(report.testResults) || report.testResults.length !== 1) return fail();
  const suite = report.testResults[0];
  if (suite?.status !== "passed" || typeof suite.name !== "string"
    || !suite.name.replaceAll("\\", "/").endsWith("/lib/billing/__tests__/newTestSubscriptionService.postgres.test.ts")
    || !Array.isArray(suite.assertionResults) || suite.assertionResults.length !== 34) return fail();
  const rows = suite.assertionResults;
  if (rows.some(row => !row || typeof row.title !== "string")) return fail();
  const passed = rows.filter(row => row.status === "passed");
  const pending = rows.filter(row => row.status === "pending");
  if (passed.length !== 32 || pending.length !== 2 || new Set(rows.map(row => row.title)).size !== 34
    || pending.some(row => !HTTP_CASES.has(row.title))
    || passed.filter(row => row.title.startsWith("legacy real PG ")).length !== 6
    || passed.filter(row => row.title.startsWith("V2 ")).length !== 19) return fail();
  return { schemaVersion: 1, evidenceScope: "owned_postgres_synthetic_provider", sqlCasesPassed: 32,
    legacyAdmissionCasesPassed: 6, allocationCasesPassed: 19, httpCasesSkipped: 2,
    hostedPaymentVerified: false, productionChanges: false };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(checkOwnedCommercialAcceptance(JSON.parse(readFileSync(process.argv[2], "utf8"))))); }
  catch { console.error("owned_pg_evidence_incomplete"); process.exitCode = 1; }
}
