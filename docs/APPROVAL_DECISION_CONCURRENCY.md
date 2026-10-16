# Approval decision concurrency

Reviewed 2026-10-16. Approval form and JSON mutation routes require the authenticated workspace's current approval role; existing JSON session/plan entitlement checks remain. Caller-supplied organization identifiers do not authorize a mutation.

Decisions consume a pending or snoozed approval using one conditional database update bound to item ID, organization, observed status and updatedAt revision. The update records actor/time and clears snooze state for approve/reject. A competing or stale decision is refused; the single-item HTTP boundary returns 409, while batch responses preserve per-item success/failure results. Applied and other terminal/nonactionable items cannot be overwritten or revived by a fresh approval. Recovery from a failed execution requires a separately reviewed workflow.

The form route emits success audit evidence only after winning the update. An audit outage does not undo the committed decision or turn it into a failed response. Existing approval-item upserts retain update:{} and do not rewrite the approved snapshot.

Regression evidence exercises two concurrent shared-service calls against one atomic in-memory persistence boundary, stale revisions, terminal states, tenant isolation, server-resolved role checks, conflict responses and audit outages. This proves application behavior under a modeled conditional database update, not a real PostgreSQL concurrency test or provider/customer acceptance.

This does not establish approved Terraform artifact integrity. Downloaded HCL remains a review/export fragment, not a saved binary Terraform plan. Saved-plan bytes/digest, target/backend/state binding and executor authority remain separate missing contracts; legacy apply and local execution gates stay disabled. JSON list/history reads also require current accepted workspace membership, scope queries to that workspace, and return indistinguishable 404 responses for unavailable history. Read-only members retain access; approval authority is required only for mutations.

Cookie-authenticated mutation routes require an exact same-origin Origin header before session or approval IO; missing, null and foreign origins are refused. GET reads retain their membership boundary without an Origin requirement.

Committed form decisions return to the absolute approvals queue; only same-origin queue query parameters are retained from navigation metadata.
