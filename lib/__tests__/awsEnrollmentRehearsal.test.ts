import { describe, expect, it } from "vitest";
import { validateAwsEnrollmentRehearsalTarget } from "../../scripts/rehearse-aws-enrollment.mjs";

describe("AWS enrollment SQL fixture target isolation", () => {
  it.each([
    undefined, "", "postgresql://production.example/axiom_aws_enrollment_rehearsal",
    "postgresql://127.0.0.1/production", "postgresql://localhost/axiom_aws_enrollment_rehearsal",
    "postgresql://127.0.0.1/axiom_aws_enrollment_rehearsal?schema=public",
    "postgresql://127.0.0.1/axiom_aws_enrollment_rehearsal#fixture", "file:/tmp/database",
  ])("refuses non-isolated targets before any connection: %s", value => {
    expect(() => validateAwsEnrollmentRehearsalTarget(value)).toThrow("isolated_aws_enrollment_target_required");
  });
  it("accepts only the exact dedicated loopback fixture", () => {
    expect(validateAwsEnrollmentRehearsalTarget("postgresql://postgres:fixture@127.0.0.1:5432/axiom_aws_enrollment_rehearsal")).toContain("/axiom_aws_enrollment_rehearsal");
  });
});
