import { expect, it } from "vitest";
import { checkOwnedCommercialAcceptance } from "../../scripts/check-owned-commercial-acceptance.mjs";

const httpTitles = [
  "actual local Next HTTP authenticates, reads versioned allowance, denies unsupported operations and releases provider-disabled hold",
  "actual owned pricing HTTP checkout and signed webhook compose existing TEST service in a separate synthetic worker",
];
function report() {
  const assertionResults = [
    ...Array.from({ length: 6 }, (_, i) => ({ title: `legacy real PG case ${i}`, status: "passed" })),
    ...Array.from({ length: 19 }, (_, i) => ({ title: `V2 case ${i}`, status: "passed" })),
    ...Array.from({ length: 7 }, (_, i) => ({ title: `service case ${i}`, status: "passed" })),
    ...httpTitles.map(title => ({ title, status: "pending" })),
  ];
  return { success: true, numTotalTests: 34, numPassedTests: 32, numFailedTests: 0, numPendingTests: 2, numFailedTestSuites: 0,
    testResults: [{ name: "/fixture/lib/billing/__tests__/newTestSubscriptionService.postgres.test.ts", status: "passed", assertionResults }] };
}
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
it.each([null, {}, { success: false }, { ...report(), numFailedTestSuites: 1 }, { ...report(), numPassedTests: 0 }])("refuses missing or unsuccessful execution evidence %j", value => {
  expect(() => checkOwnedCommercialAcceptance(value)).toThrow("owned_pg_evidence_incomplete");
});
