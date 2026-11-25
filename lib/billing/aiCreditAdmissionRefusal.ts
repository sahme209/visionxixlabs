/** A known pre-dispatch reservation denial. This says nothing about whether
 * a previous request consumed credits; uncertain claims use a different path. */
export class AICreditAdmissionRefusal extends Error {
  constructor(readonly reason: "ai_credit_pool_exhausted" | "ai_workspace_budget_exceeded" = "ai_credit_pool_exhausted") {
    super("ai_credit_admission_denied");
    this.name = "AICreditAdmissionRefusal";
  }
}
