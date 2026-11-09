# Production build 4 (2026-11-09)

Deployed by the owner from Vercel (Deployments → Create Deployment → `main` → Production) at commit `a344f4f6` (merge of #313). CI on that commit: all checks green.

**Database:** no step. No `prisma/` changes since build 3. The newest repo migration, `20261109100000_add_audit_seal`, is the one build 3 verified as applied in production.

**Smoke checks (curl, signed out):**
- 16 public pages return 200: `/`, `/product`, `/security`, `/integrations`, `/plans`, `/download`, `/docs`, `/docs/members`, `/docs/governance-approvals`, `/docs/usage-billing`, `/docs/trust-tools`, `/docs/ask-axiom`, `/privacy`, `/terms`, `/contact`, `/status`.
- New content is present: the Members guide Governance note, the Trust tools anchor section, and the Ask Axiom "expiring soon" action.
- Refusals hold:
  - `/api/v1/governance/check` → 401 `no_bearer_token`;
  - `/api/v1/mcp` (valid JSON-RPC) → 401 `no_bearer_token`;
  - `/api/audit/anchor` → 401;
  - `/api/support/action` → 401 `sign_in_required`;
  - `/api/desktop/governance-intelligence/readiness` → 503 `governance_intelligence_disabled` (off by default, as intended).
- Ask Axiom answers the audit-tampering question with sources (`/security`, `/docs/trust-tools`) and refuses a pasted AWS key (`guarded`, `secret_pasted`).
- `/control/trust-tools`, `/control/api-keys`, `/control/members`, `/control/governance` and `/control/usage-billing` return 307 to `/auth/signin?callbackUrl=…`.
