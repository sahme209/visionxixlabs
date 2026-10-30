# Separate provenance review from provider-action review

Observed in the actual app: ServiceNow association a95c6298 was independently approved, then its unused link draft was amended and independently approved as version2. The action retained the association's 10:16:49 deadline. By the time the requester returned and loaded the action, that shared deadline had elapsed. No claim or provider write occurred. Jira has the same shared-deadline design.

Proposed local correction:
- Allow an evidence-association review up to 30 minutes, with existing current-reader, original provenance, exact ticket read, accepted deployment, current connection/revision and revocation checks unchanged. This review grants no provider execution.
- When the requester prepares a link or closure, give that exact provider candidate at most 15 fresh minutes, capped by the approved association's remaining lifetime and any native discovery/terminal-policy deadline.
- Revalidation must preserve the candidate's recorded deadline rather than recomputing or extending it. Reject a candidate beyond the cap, expired sources, changed access, changed target/content, or expired native policy.
- Existing unused drafts may be explicitly amended through the current reviewed recovery path; the old approval is cleared. Consumed attempts, old approvals and historical evidence remain unchanged.
- Human reviewers still personally approve exact provider target/content. Only the designated requester executes, once, after current provider/native validation. No background refresh, resend, automatic approval or bypass.

Validation: reproduce requester preparation after a 10-minute association review; verify the new provider plan has 15 minutes (subject to remaining association/native deadlines), stays unchanged on later verification, rejects overlong/tampered deadlines, clears approvals on amendment, and preserves no-resend/one-attempt rules. Cover both Jira and ServiceNow with existing stores and isolated local PostgreSQL where meaningful.

This changes the reviewed provenance approval window and requires explicit validation-first approval before implementation. Local code/tests only; no deployment, settings, schema, provider grant or ticket write is included.
