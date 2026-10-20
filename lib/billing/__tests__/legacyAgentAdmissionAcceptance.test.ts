import { describe, expect, it, vi } from "vitest";

// Declaration/closed-outcome tests have no ambient Prisma client or IO path.
vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get() { throw new Error("inert_acceptance_declaration_no_database"); } }) }));
import { legacyAgentAdmissionPostgresCases, legacyClaimOutcome } from "./fixtures/legacyAgentAdmissionAcceptance";

describe("owned legacy PG admission acceptance declarations (not SQL execution)", () => {
  it("declares six existing-fixture callbacks without requesting a database context", () => {
    const context = vi.fn(() => { throw new Error("no_database_authorized"); });
    const cases = legacyAgentAdmissionPostgresCases({ context });
    expect(context).not.toHaveBeenCalled();
    expect(cases).toHaveLength(6);
    expect(new Set(cases.map(test => test.name)).size).toBe(6);
    expect(cases.every(test => typeof test.run === "function")).toBe(true);
    expect(cases.map(test => test.name)).toEqual([
      "legacy real PG concurrent claim has exactly one winner under Serializable row locking",
      "legacy real PG expired or unaccepted member holds cannot be claimed",
      "legacy real PG revocation committed before the membership lock cannot authorize dispatch",
      "legacy real PG claimed hold remains capacity and cannot release after database-clock expiry",
      "legacy real PG admitted synthetic generation links exactly one fresh pending event",
      "legacy real PG hold-link failure rolls back fresh usage and keeps uncertain dispatch",
    ]);
  });
  it.each([
    { result: { status: "fulfilled", value: true }, verdict: "claimed" },
    { result: { status: "fulfilled", value: false }, verdict: "refused" },
    { result: { status: "rejected", reason: { code: "P2034" } }, verdict: "serialization_conflict" },
    { result: { status: "rejected", reason: { code: "P2010", meta: { code: "40001" } } }, verdict: "serialization_conflict" },
    { result: { status: "rejected", reason: { code: "P2010", meta: { code: "23505" } } }, verdict: "unexpected_error" },
    { result: { status: "rejected", reason: { code: "P1001" } }, verdict: "unexpected_error" },
    { result: { status: "rejected", reason: "private runtime information" }, verdict: "unexpected_error" },
  ] as const)("classifies only closed transaction outcomes: $verdict", ({ result, verdict }) => {
    expect(legacyClaimOutcome(result)).toBe(verdict);
  });
  it("does not invoke error getters or mistake an unrelated error for expected concurrency refusal", () => {
    const get = vi.fn(() => { throw new Error("private detail"); });
    const reason = Object.defineProperty({}, "code", { get });
    expect(legacyClaimOutcome({ status: "rejected", reason })).toBe("unexpected_error");
    expect(get).not.toHaveBeenCalled();
    expect(legacyClaimOutcome({ status: "rejected", reason: new Error("40001 arbitrary text is not proof") })).toBe("unexpected_error");
  });
});
