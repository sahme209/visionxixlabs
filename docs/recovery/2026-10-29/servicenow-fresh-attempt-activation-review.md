# One ServiceNow recovery activation

Local source: 6f3da0fd2f0541e02acbf265ebeb69eba40dd33d. Private backup branch backup/axiom-repairs-2026-10-30 matches this commit; no CI was triggered. Incremental bundle verifies. Public immutable v0.1.21 remains intact.

Candidate: /private/tmp/axiom-sn-fresh-reviewed-candidate-20261030, built from current production 771558f3 plus only the reviewed backend recovery overlay. No schema, settings, credentials, provider scopes, unrelated website or CI workflow changes. The signed local native app is /private/tmp/axiom-sn-fresh-review-6f3da0fd/Axiom Agent.app and has not been opened; current paired sessions are preserved.

The new explicit read-only proof check verifies narrow journal access and exact original-note absence. Preparation creates only one deterministic separately approved child of a known refused, definitely-unwritten parent. Parent version/digest/history, original note marker, same requester/executor and current administrator authority are rechecked. Unknown/possibly-written parents and retry chains are refused. A consumed child cannot be resent. Original b38/v8/refused/attempt1 remains untouched.

The change also forwards ServiceNow confirmation context through the durable claim check and raises only the bounded HTTP observation wait from 25 to 60 seconds. Provider 15-second execution, claim/lease and action approval deadlines remain unchanged; no automatic retries.

Evidence: 118 focused tests plus 14 final client/composition checks passed. Ten existing actual isolated PostgreSQL journeys passed; one new child journey passed separately with 10 skipped. Database providers were simulated. Scoped backend types, desktop types/frontend build, embedded native build and strict/deep Developer ID signature pass. Production build receipts are in work/ticket-install-completion/sn-fresh-exact-production-build.log. Final review found and verified correction of a current-admin downgrade gap; an accidental Jira type access was removed. No live proof read, append/readback or ServiceNow closure has been accepted.

Requested activation: ONE backend deployment of this exact candidate and opening the signed local app, followed by supported existing-connection refresh and read-only proof checks. This may consume Vercel build allowance. No paid GitHub build or public installer publication is included. A fresh exact note execution still needs its own recorded requester authorization and genuine independent human approval; closure must follow ServiceNow's actual native approval lifecycle and a separately approved terminal policy/action.

Windows installation testing is deferred by the user's current priority. New public installer shipping requires a new version and normal protected publication; existing v0.1.21 cannot be overwritten.
