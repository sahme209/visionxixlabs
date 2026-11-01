# Saved execution-limit policies and original decision directory

Local-only continuation. The native prototype can deliberately load a bounded saved-policy directory and recorded-decision metadata. It no longer requires remembering every policy ID. Selecting an entry sets an ID only; exact current policy load and independent decisions remain separate.

## Authority and limits

Saved policies require current paired workspace-reader authority, tenant-scoped queries and full immutable revision/history validation. Original request metadata additionally filters current actor and exact paired session, then validates each original receipt/audit chain. Metadata contains original nonce, operation, date and digest, plus a revision ID for non-activation receipts. No provider credentials, new grants, current execution permission or auto-resend capability is returned.

At most20 entries are displayed, with explicit truncation. Empty/bounded lists are not proof of complete history or absence of an unrecorded/in-flight request. Historical receipts are not current activation state. Restart with the existing saved paired session can rediscover recorded decisions; original receipts from a different paired session remain inaccessible under the unchanged exact-session boundary. Transactions that never committed a receipt are not represented as confirmed results. Pending unrecorded-request recovery across restart remains unfinished.

## Verified locally

45 checks passed across store, HTTP, native client and panel (overlapping prior suites). The new store and HTTP discovery checks first failed before implementation. Scoped server and desktop TypeScript, frontend production build and independent source review pass. The frontend retains its existing large-chunk warning.

One expanded actual owned isolated PostgreSQL HTTP journey passed, including exact JSON session filtering, original request discovery, revoked-policy metadata, empty executor history, and unchanged durable-row count. Four earlier cases were filtered/skipped. Authentication was simulated; roles, sessions, records and audits were real isolated PostgreSQL. The owned fixture was stopped. No existing DB, provider, human approval or production setting was touched.

## Not complete

Proposal authoring, principal selection and unrecorded pending-request restart recovery; complete executor coverage, baseline enrollment and comprehensive enforcement; current exact full production/native batch verification and authorized live acceptance. No installer was built/published, no app relaunched and Governance remains undeployed/OFF.

Evidence: /private/tmp/axiom-policy-directory-{red,green,http-red,unit,native,desktop-types,server-types,pg,frontend-build}.log.
