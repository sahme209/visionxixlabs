# Governance and guided workflow local progress

This increment is local implementation, not active organization enforcement or customer discovery.

- Canonical immutable evidence artifacts use existing durable tables and audit events; three isolated PostgreSQL tests passed with simulated sources.
- Freshness compares separately collected current evidence with approved history. Changed, incomplete, expired or different-connection evidence refuses admission.
- Request-local preflight performs provider reads outside database locks and rechecks authority under the existing locked path.
- GitHub discovery uses existing installation read authorization, fixed GET operations, bounded bodies, current organization/installation checks and explicit denied results. Three adapter tests passed; no live customer reads were made.
- Collection composition checks principal before/after source reads, then delegates to the independently authorized durable save. Three tests and scoped production TypeScript passed.
- Shared Governance journey presentation distinguishes source readiness, independent review, activation, coverage and recovery. Four tests passed.
- Bot composer explains Send versus Save draft once, puts input limits in a disclosure, and retains loading, errors and uncertainty. Settings links directly to Governance. Thirty-four component tests and desktop TypeScript passed.

Still required: request/HTTP composition with real current principals, AWS adapter, baseline/discovery UI, exact executor coverage and drift journeys, final review/build/native visual acceptance. No universal enforcement claim is justified. ServiceNow activation candidate remains separate and unchanged. No deployment, schema change, provider write, paid CI or installer publication occurred.
