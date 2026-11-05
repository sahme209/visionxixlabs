import { AxiomError } from "@/lib/errors/axiomErrors";

/** A server-global GitHub credential does not prove workspace ownership. */
export class TenantGithubSourceUnavailableError extends AxiomError {
  constructor() {
    super({
      code: "github.tenant_source_required",
      category: "precondition",
      userMessage: "Live GitHub discovery is unavailable until a workspace-bound source is verified.",
    });
  }
}
