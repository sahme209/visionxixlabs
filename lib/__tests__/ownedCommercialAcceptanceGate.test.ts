import { expect, it } from "vitest";
import { checkOwnedApplicationHttpAcceptance, checkOwnedCommercialAcceptance } from "../../scripts/check-owned-commercial-acceptance.mjs";

const httpTitles = [
  "actual local Next HTTP authenticates, reads versioned allowance, denies unsupported operations and releases provider-disabled hold",
  "actual owned pricing HTTP checkout and signed webhook compose existing TEST service in a separate synthetic worker",
];
function report() {
  const assertionResults = [
    ...Array.from({ length: 6 }, (_, i) => ({ title: `legacy real PG case ${i}`, status: "passed" })),
    ...Array.from({ length: 19 }, (_, i) => ({ title: `V2 case ${i}`, status: "passed" })),
    ...Array.from({ length: 7 }, (_, i) => ({ title: `service case ${i}`, status: "passed" })),
    ...httpTitles.map(title => ({ title, status: "skipped" })),
  ];
  return { success: true, numTotalTests: 34, numPassedTests: 32, numFailedTests: 0, numPendingTests: 2, numFailedTestSuites: 0,
    testResults: [{ name: "/fixture/lib/billing/__tests__/newTestSubscriptionService.postgres.test.ts", status: "passed", assertionResults }] };
}
function httpReport() {
  const value = report(); value.numPassedTests = 1; value.numPendingTests = 33;
  value.testResults[0].assertionResults.forEach(row => { row.status = row.title === httpTitles[0] ? "passed" : "skipped"; });
  return value;
}
it("requires the actual isolated application HTTP journey independently of the SQL job", () => {
  expect(checkOwnedApplicationHttpAcceptance(httpReport())).toEqual({ schemaVersion: 1, evidenceScope: "owned_application_http_synthetic_provider", applicationHttpCasesPassed: 1, sqlCasesSkipped: 32, checkoutWorkerCaseSkipped: true, hostedPaymentVerified: false, productionChanges: false });
});
it("never substitutes SQL-only success for application HTTP success or vice versa", () => {
  expect(() => checkOwnedApplicationHttpAcceptance(report())).toThrow("owned_pg_evidence_incomplete");
  expect(() => checkOwnedCommercialAcceptance(httpReport())).toThrow("owned_pg_evidence_incomplete");
});
it.each([0, 33])("refuses a different sole passed case at index %s", index => {
  const value = httpReport(); value.testResults[0].assertionResults[32].status = "skipped";
  value.testResults[0].assertionResults[index].status = "passed";
  expect(() => checkOwnedApplicationHttpAcceptance(value)).toThrow("owned_pg_evidence_incomplete");
});
it("accepts completed SQL cases with explicitly separate unexecuted HTTP journeys", () => {
  expect(checkOwnedCommercialAcceptance(report())).toEqual({ schemaVersion: 1, evidenceScope: "owned_postgres_synthetic_provider", sqlCasesPassed: 32, legacyAdmissionCasesPassed: 6, allocationCasesPassed: 19, httpCasesSkipped: 2, hostedPaymentVerified: false, productionChanges: false });
});
it.each(["skipped", "pending", "failed"])("refuses a %s SQL case even if aggregate counters claim success", status => {
  const value = report(); value.testResults[0].assertionResults[0].status = status;
  expect(() => checkOwnedCommercialAcceptance(value)).toThrow("owned_pg_evidence_incomplete");
});
it("refuses a green report with missing admission or allocation coverage", () => {
  const value = report(); value.testResults[0].assertionResults[0].title = "unrelated test";
  expect(() => checkOwnedCommercialAcceptance(value)).toThrow("owned_pg_evidence_incomplete");
});
it("refuses a substituted skipped journey or wrong suite", () => {
  const value = report(); value.testResults[0].assertionResults[33].title = "SQL check silently skipped";
  expect(() => checkOwnedCommercialAcceptance(value)).toThrow("owned_pg_evidence_incomplete");
  value.testResults[0].name = "/fixture/different.test.ts";
  expect(() => checkOwnedCommercialAcceptance(value)).toThrow("owned_pg_evidence_incomplete");
});
it("uses actual Vitest skipped-row semantics rather than aggregate pending terminology", () => {
  const value = report(); value.testResults[0].assertionResults[33].status = "pending";
  expect(() => checkOwnedCommercialAcceptance(value)).toThrow("owned_pg_evidence_incomplete");
});
it.each([null, {}, { success: false }, { ...report(), numFailedTestSuites: 1 }, { ...report(), numPassedTests: 0 }])("refuses missing or unsuccessful execution evidence %j", value => {
  expect(() => checkOwnedCommercialAcceptance(value)).toThrow("owned_pg_evidence_incomplete");
});

it("verifies the named checkout worker is skipped before attesting that fact", () => {
  const value = httpReport(); value.testResults[0].assertionResults[33].title = "unrelated skipped case";
  expect(() => checkOwnedApplicationHttpAcceptance(value)).toThrow("owned_pg_evidence_incomplete");
});
