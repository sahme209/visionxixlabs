# Governance transformation progress

## Active review

- Branch: `codex/ai-agent-governance`
- Pull request: #66
- Base: `main`
- Production status: #65 is merged; the changes documented below remain unmerged and undeployed in #66

## Verified phases

### Architecture boundary

- `/control` is the authenticated governance namespace.
- Desktop remains the engineering operations workspace.
- Protected decisions and execution remain backend-owned.
- Legacy dashboard pages with static state remain closed.

### Approval decisions

- Same-origin browser mutation check and current organization membership.
- Approver-role authorization.
- Separation of duties: a proposer cannot approve or reject their own action.
- SHA-256 action binding and 24-hour approval expiry on new proposals.
- Atomic compare-and-set decision claim and immutable decision audit record.
- Shared decision service for browser and desktop origins.
- Existing idempotency key retained for external execution.
- Legacy proposals without an integrity digest cannot be decided in the browser.

Verification: Prisma generation, TypeScript, and 32 focused approval/security/routing tests pass.

### AI and Agent policy

- `/control/ai-agents` reads real organization policy; it contains no simulated model, spend, or agent state.
- Model authorization is restricted to service-configured Vercel AI Gateway routing and live Gateway catalog IDs.
- A persisted workspace Agent identity controls its enabled state and exact backend tool allowlist.
- Disallowed tools are removed from the model prompt and independently blocked before any tool execution.
- Existing organizations are migration-backfilled to preserve their enabled Agent; new organizations fail closed until an owner enables one.
- Autonomy and per-cycle action limits reuse the existing tenant charter; run cost reuses the existing organization budget record.
- Browser mutations require same-origin owner/admin authority and derive the organization from the authenticated session.
- Autonomy reads no longer disclose a stored Slack webhook override.

Verification: Prisma generation, TypeScript, and 32 focused policy, Agent-runtime, origin, RBAC, tenant-isolation, and tool-enforcement tests pass.

### Integration authority

- `/control/integrations` is now the single website-owned integration administration surface; the legacy account route redirects to it.
- GitHub, Slack, Teams, Linear, Airflow, AWS, Azure, and Google Cloud status comes from tenant-scoped backend records, never display fixtures.
- GitHub validation freshness and repository-selection policy are visible without exposing installation credentials.
- Collaboration connections show their granted scopes and last successful validation; OAuth, pause/resume, and revocation continue through the existing same-origin, owner/admin-protected endpoints.
- Airflow exposes only secret-free validation metadata. Its desktop credential-entry flow remains in place until a web migration has security and revocation parity.
- Desktop integration state remains read-only and uses the same authoritative connection records.

Verification: TypeScript and 16 focused OAuth, origin, RBAC, desktop-handoff, validation, and tenant-status tests pass.

### Usage and billing visibility

- `/control/usage-billing` shows the signed organization subscription, accepted-member/paid-seat state, transactionally counted deployment allowance, settled Gateway debit, pending settlement count, token usage, and paid credit ledger records.
- The personal account page no longer duplicates organization AI or billing administration; it links authorized administrators into Axiom Control.
- Subscription checkout returns to the authoritative control-plane billing route, while signed Stripe subscription events remain the only entitlement authority.
- The former AI add-on endpoint no longer fabricates a Checkout session or writes a fake pending purchase. It fails closed until one-time Stripe fulfillment, refunds, and replay handling are verified.
- The UI labels unsettled Gateway generations explicitly and never reports them as free usage.

Verification: TypeScript and 34 focused checkout, webhook, replay, seat, deployment-quota, Gateway-settlement, origin, RBAC, and no-placeholder-credit tests pass.

## Next phases

1. Implement real Stripe test-mode credit checkout, signed fulfillment/refund reversal, and atomic AI credit reservation/settlement.
2. Verified audit/security search and session controls.
3. Durable autonomous workflow persistence, leasing, pause/resume, retry, cancellation, and recovery.
4. Migrate Airflow credential administration to web only after parity tests; retain desktop operational DAG controls.

No live billing activation, production deployment, desktop release, or merge is authorized by this record.
