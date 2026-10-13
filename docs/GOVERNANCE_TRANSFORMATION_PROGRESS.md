# Governance transformation progress

## Active review

- Branch: `codex/governance-control-plane`
- Pull request: #65
- Base: `main`
- Production status: not merged or deployed

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

## Next phases

1. Organization AI/model/agent policy administration.
2. Central integration consent, health, scopes, and revocation.
3. Usage, billing, seats, deployment allowance, and AI wallet views.
4. Verified audit/security search and session controls.
5. Durable autonomous workflow persistence, leasing, pause/resume, retry, cancellation, and recovery.

No live billing activation, production deployment, desktop release, or merge is authorized by this record.
