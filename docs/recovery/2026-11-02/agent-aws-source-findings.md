# AWS workflow source — verified constraints for the remaining local work

This is investigation, not an implemented source policy or authority/coverage receipt.

- Current agentActionDeploymentExecution.ts captures a current ECS target and policy/quota reservation, but sourceRef still defaults to main and no proposal-time workflow commit is bound. The public requester API therefore still refuses this tool.
- Current githubWriteClient.dispatchWorkflow already uses GitHub API2026-03-10 and reads the returned exact run identity. Do not reimplement that migration or spend on another CI run to rediscover it.
- GitHub documents dispatch refs as branch/tag names; current API responses identify the run. An observed run ID helps result correlation but does not itself prevent floating workflow code from changing before execution. Source qualification must not treat a guessed commit string as a documented atomic ref precondition. Source: https://docs.github.com/en/rest/actions/workflows?apiVersion=2026-03-10 .
- The existing createImmutableReleasePolicyReader is tied to actual DeploymentPlan/release-parent/current-authority and dedicated read-credential evidence. Never construct a fake plan, synthetic parent or no-op authority callback merely to reuse it as a permission issuer.
- Remaining implementation needs proposal-time exact workflow/source evidence plus provider-enforced source stability and current exact target checks. The fixed action restarts the current ECS task definition; it must not become image/artifact promotion, broadened IAM permissions, a new grant or automatic dispatch/retry.

No customer repository/cloud read, credential issuance, CI/dispatch, grant or configuration action was performed during this investigation. Local source implementation and simulated validation remain available under the approved plan; live discovery/action and activation need their existing specific authorizations. PR pre/post checks are not a substitute for stable deployment-execution code.
