import type { GovernedAiCallError } from "./governedAiCall";

/** Server-owned policy refusal is not malformed model output and cannot grant
 * a repair attempt. Only fixed existing public error codes are carried. */
export class GovernedAiCallRefusal extends Error {
  constructor(readonly code: GovernedAiCallError) {
    super(code);
    this.name = "GovernedAiCallRefusal";
  }
}
