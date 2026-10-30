# Read-only preflight inspection for a consumed ServiceNow action

The exact journal-proof path is accepted. Both original b38 and fresh7292 are consumed/refused/attempt1; neither may be replayed. Logging added after the attempts cannot recover their historical failure phases. Static review found no deterministic cause; repeated durable/native reads inside the 15-second transport budget are an unconfirmed candidate.

Proposed local-only diagnostic: inspect the current prerequisites for one explicit saved action and current independently approved association. Reuse current authenticated requester/admin checks and exact binding, original record, credential, source, journal-proof and native model readers. Report only fixed phase names, pass/refused/timeout, and bounded elapsed durations. No token, provider response, ticket text or arbitrary target is returned.

The diagnostic never claims an action, restores an approval, changes an attempt, creates a child, or reaches a mutation transport. Its provider fetch adapter accepts GET only and rejects all other methods before network use. Saved refusal remains untouched. Results are labelled read-only current observations, not a reconstruction of the old failure and not execution authorization. Expired associations and changed current access remain rejected.

Tests must prove a delayed native reader is classified without a provider write; non-GET calls are rejected; cross-workspace/target/association reads are refused; and no durable mutation, workflow dispatch or provider resend occurs. Any eventual runtime optimization must be reviewed against the original lease/expiry/independent-approval boundaries.

Approval requested for local code/tests only. Deployment, provider writes, retry recovery policy and new human approvals remain separate.
