/** A known pre-dispatch reservation denial. This says nothing about whether
 * a previous request consumed credits; uncertain claims use a different path. */
export class AICreditAdmissionRefusal extends Error {
  constructor() {
    super("ai_credit_admission_denied");
    this.name = "AICreditAdmissionRefusal";
  }
}
