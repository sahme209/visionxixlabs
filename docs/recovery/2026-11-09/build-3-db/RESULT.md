# Build 3 database step: executed and verified (2026-11-09)

Run by the owner in the Neon SQL Editor (production, `main` branch).

1. `1-PRECHECK-READ-ONLY.sql`: latest_applied = 20261108120000_add_pipeline_ai_call_quote_fields, unfinished 0, both tables absent, 0 new ledger rows.
2. `2-APPLY-ALL-OR-NOTHING.sql`: "Statement executed successfully".
3. `3-VERIFY-READ-ONLY.sql`: latest_applied = 20261109100000_add_audit_seal, unfinished 0, AgentGatewayRequest and AuditSeal present, 0 rows each.

Then production build 3 deployed from main `61c69e65`. Smoke checks:
- Public pages (home, product, security, integrations, plans, download, docs, the five new guides, privacy, terms, contact, status, demo) return 200.
- The new home hero, the "Govern any AI agent" section and the Axiom legal sections are live.
- `/faq` redirects to `/docs/faq`; `/platforms` redirects to `/download`.
- `/api/v1/mcp` and `/api/v1/governance/check` refuse without a key (401 `no_bearer_token`).
- Ask Axiom answers with sources, and refuses a pasted secret (`guarded`, `secret_pasted`).
- AI answers require sign-in (401).
- `/control/agent-gateway`, `/control/trust-tools` and `/control/api-keys` redirect to sign-in with a return path.
- `/dashboard/*` still redirects to `/download`.
