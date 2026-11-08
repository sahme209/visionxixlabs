# Consolidated threat model: tenant, session, secret and tool coverage

Date: 2026-11-08. Master plan item: A7.13.

**Read this first.** This is a self-prepared engineering threat model written from a source read of the repository. It is **not** an independent security assessment, audit or penetration test. Nothing here was exercised against a running deployment. A7.14 (independent assessment / penetration test) remains open. "Implemented" below means "the code we read does this", not "proven in production". Anything we did not trace is marked **unverified**.

This document builds on, and does not replace:

- [Current bootstrap threat model](current-bootstrap-threat-model.md): private native issuer/broker bootstrap, Keychain resource delivery (unexecuted, not accepted).
- [Product trust-boundary threat model](product-trust-boundary-threat-model.md): 16 boundaries T01-T16 with source-hash bindings.
- [Runtime trust-boundary threat model](runtime-trust-boundary-threat-model.md): historical runtime chain.
- [Product security model recovery notes](../../recovery/2026-11-05/product-security-model/README.md) and its [independent-review note](../../recovery/2026-11-05/product-security-model/independent-review.md) (an internal second read of the same source, not external assurance).
- [Desktop security model](../../../desktop/security.md).

Where those documents already cover a boundary in depth, this one cites the T-number instead of repeating it.

---

## 1. Scope, assets and trust boundaries

### Components in scope

| Component | Notes |
| --- | --- |
| Browser web app (Next.js 16, hosted on Vercel) | Dashboard, `/demo` sandbox, public site. Edge logic in `proxy.ts`. |
| Desktop app (Tauri, `desktop/`) | Paired to a web workspace; holds a device bearer token. Local execution is disabled (see `desktop/security.md`). |
| Public API `/api/v1/*` | 10 route files; API-key authenticated (except the public JWKS route `app/api/v1/webhooks/jwks/route.ts`). |
| Internal API `/api/*` | ~735 route files; mostly session (cookie) authenticated. |
| Database | Prisma over Postgres (Neon). Global client in `lib/db.ts`. No Postgres row-level security found in `prisma/`. |
| AI gateway / model providers | Governed path in `lib/axiom/agentRuntime/governedAiCall.ts`, legacy bot path (T11). |
| Connected providers | GitHub (App installation tokens), AWS, Azure, GCP, ServiceNow, Jira, Slack, Outlook, Airflow and others under `lib/connectors/`. |
| Stripe | Donations and prepaid AI credits; webhooks at `app/api/webhooks/stripe/route.ts` and `app/api/support/stripe-webhook/route.ts`. |
| Email (Resend) | Verification mail in `lib/auth/emailVerification.ts`. |

### Assets

Tenant data (repository content, tickets, cloud inventory, chat transcripts, workspace memory); user identities, sessions and memberships; provider credentials and OAuth tokens; API keys; desktop session tokens; signing/encryption keys held in environment; approvals and proposals; AI credit balance and holds; audit history; release/installer integrity.

### Trust boundaries

```
B1 Internet/browser  --cookie JWT-->  B2 Web app (Vercel)  --Prisma-->  B5 Postgres (Neon)
B3 Desktop app       --bearer token-->  B2
B4 API client        --API key-->  B2 /api/v1
B2  --prompt/context-->  B6 AI gateway / model providers
B2  --stored credential-->  B7 Connected providers (GitHub, clouds, ITSM, chat)
B8 Stripe  --signed webhook-->  B2
B9 Build/deploy (GitHub repo, Vercel env)  --> B2
```

The tenant boundary (one workspace versus another) cuts across B2 and B5 and is the most important logical boundary; it is not a network boundary.

---

## 2. Tenant isolation

### How tenant scope is established

- `lib/auth/currentContext.ts` `currentContext()` reads the NextAuth session, derives a personal workspace id from the email (`lib/auth/workspaceId.ts` `deriveWorkspaceIdFromEmail`: `ws_` + first 16 hex of SHA-256 of the lower-cased email), and optionally reads a selected-workspace cookie (`lib/auth/workspaceSelection.ts`).
- `resolveWorkspaceRoles` looks up `orgMembership` by `(userId, organizationId)`. A membership row only yields a role if `acceptedAt` is set. If a selected (non-personal) workspace has no accepted role, `currentContext()` returns **no `organizationId`**, so downstream code that requires one fails closed. This matches T01 in the product model.
- `requireContext()` (same file) is the strict variant; about 378 internal route files call `currentContext()` or `requireContext()`.
- API keys carry their own `organizationId` from the key record (`lib/security/authenticateApiKey.ts`).
- Desktop tokens resolve to a durable session, then current membership/capabilities (`lib/desktop/desktopSessionResolverCore.ts`, T02).

### How queries are scoped

- Helpers exist: `lib/security/tenantIsolation.ts` (`tenantWhere`, `tenantData`, cross-tenant detection with audit) and `lib/security/tenantScope.ts` (`enforceTenant`, `filterByTenant`, `requireRole`). The header comment says "every customer-data query passes through a TenantScope gate".
- **That claim is not true of the codebase today.** Only 2 non-test files import `tenantWhere`/`enforceTenant`. `lib/security/apiGuard.ts` `guard()` is imported by 0 non-test files. In practice each route/service adds `organizationId` to its own Prisma `where` clauses by hand (442 route files mention `organizationId`).
- There is no database-level backstop (no Postgres RLS, no Prisma extension that injects the tenant filter was found).

So tenant isolation is a **convention enforced per call site**, not a structural guarantee. Each call site may well be correct; we did not audit them all (**unverified**).

### Demo-data leak guard

- `lib/workspace/workspaceKind.ts`: `resolveWorkspaceKind` is a pure prefix check (`ws_sandbox_` → sandbox, `ws_internal_` → internal, else real; default is "real", which fails safe). `isSandboxWorkspace` and `assertNotDemoLeak` (throws `DemoLeakError` on a real workspace) build on it.
- Observed call sites of `assertNotDemoLeak`: `app/api/demo/populate/route.ts`, `app/api/demo/cleanup/route.ts`, `lib/demo/scenarioKnowledge.ts`, `lib/demo/technicalReference.ts`. `isSandboxWorkspace` appears in 4 files.
- Whether *every* mock/example data path is guarded (the CLAUDE.md rule) is **unverified**; we did not inventory all mock producers.
- Note: real workspace ids come from a hash (`ws_<16 hex>`), so a real user cannot be assigned a `ws_sandbox_` id by email derivation. Whether any admin or invite flow can create an organization with a chosen id is **unverified**.

### Cross-tenant risks

| Risk | Comment |
| --- | --- |
| IDOR: route loads a record by id without an `organizationId` filter | Main residual risk given hand-written scoping across ~700 routes. |
| Background jobs/crons acting across tenants | Jobs do not have a session; scope comes from data. Not inventoried (**unverified**). |
| Caches keyed without tenant | GitHub token caches are scoped per T06; other caches **unverified**. |
| Ciphertext swap between tenants | Mitigated for scoped envelopes by AES-GCM AAD context (section 4); legacy envelope has no context. |
| Legacy public bot chat loads by bot id (T11) | Distinct call family; intended public-bot ownership still unqualified. |
| Personal-workspace id derived from email | Changing or re-using an email maps to the same workspace id. Credentials sign-in requires `emailVerifiedAt` (`lib/auth.ts` line ~50). OAuth providers (Google, GitHub, Cognito) are trusted for email; whether unverified provider emails are refused is **unverified**. |

---

## 3. Sessions and identity

### Web (NextAuth) — `lib/auth.ts`

- Providers: Credentials (password hash + required `emailVerifiedAt`), Google, GitHub, Cognito.
- `session: { strategy: "jwt", maxAge: 30 days }`. JWT sessions are stateless: **there is no server-side revocation** of an issued browser session before expiry. Authority is partly re-derived per request because `currentContext()` re-reads membership, so removing a membership does cut access to that workspace; but a stolen cookie stays valid for the personal workspace until expiry.
- `signIn` callback denies providers that return no email, upserts identity, and applies SSO gating (role mapping must be a valid `OrgRole`, else deny). Denials and successes are audited best-effort.
- Platform-admin is an email allowlist (`lib/auth/platformAdmin.ts` `isPlatformAdmin`, `listAdminEmails`). Security of admin therefore depends on the email identity of the provider; no step-up/MFA requirement found (**gap**).
- Same-origin checks exist for mutations (`lib/auth/requestOrigin.ts` `isSameOriginRequest`, `lib/auth/integrationMutationContext.ts`); coverage across all mutating routes **unverified**.

### Desktop pairing and sessions

- Token: `lib/desktop/desktopToken.ts` `mintDesktopToken`/`verifyDesktopToken`, HMAC over a session id, constant-time compare (T02). Signing key falls back to the NextAuth secret if the dedicated desktop key is absent, so the two secrets may be shared (**gap**: one key compromise covers both).
- The token itself has no expiry; `lib/desktop/desktopSession.ts` holds TTL (default and max 30 days), status `active | revoked | expired`, and "revoked sessions are never resurrected". `revokeDesktopSession` exists.
- `desktopSession.ts` falls back to an in-memory store when no database URL is configured. That is fine for tests but would lose revocations across instances if it ever ran in production (**unverified** that it cannot).
- Exact-build pairing, storage in the OS keychain, logout and rotation are not accepted; `desktop/security.md` lists OS keychain storage as **planned**.

### API keys — `/api/v1`

- `lib/security/apiKeyCrypto.ts`: random key with checksum, stored as SHA-256 hash, constant-time compare (`verifyKeyHash`), prefix for lookup.
- `lib/security/authenticateApiKey.ts`: rejects revoked and expired keys, audits denials, enforces closed-union scopes from `lib/security/apiKeyScope.ts` (`pipeline:*`, `eval:*`, `release_gate:read`, `webhook:*`, and catch-all `*`).
- All 9 non-JWKS v1 routes reference `authenticateApiKey` (string match; per-route scope correctness **unverified**).
- Gap: keys may have `expiresAt = null` (no forced expiry). The `*` scope is "Enterprise only — admin route must verify"; that admin check is **unverified**.

---

## 4. Secrets and credentials

### Storage and encryption

- `lib/security/credentialVault.ts` (canonical; `lib/credentialEncrypt.ts` is a deprecated re-export):
  - Legacy envelope `encryptCredential`/`decryptCredential`: AES-256-GCM, **no per-record context**. Key comes from an environment variable with a fallback to a second, unrelated secret.
  - Scoped envelope `encryptScopedCredential`/`decryptScopedCredential` (via `lib/security/credentialVaultCrypto.ts`): AES-256-GCM, random IV, AAD bound to organization/provider/connection context. Comment requires new OAuth integrations to use it. This stops copying ciphertext between tenants/connections (T05).
- `lib/security/fieldEncryption.ts`, `credentialMeta.ts`, `secretRotationTracker.ts` exist; their call-site coverage is **unverified**.
- Private composition (`lib/security/privateCredentialVault.ts`, `privateAuthorityDatabase.ts`) avoids the global env-derived key, but the private bootstrap that would feed it is not accepted (see current bootstrap model).
- Single master key, no envelope/KMS hierarchy, no in-code key versioning seen: rotating the vault key would require re-encrypting every row (**gap**).

### Redaction

- `lib/security/redaction.ts` (`redactDeep`), `lib/security/secretRedaction.ts` (`redactSecrets`), `lib/api/redaction.ts`, AI-log redaction (T12), repository evidence redaction (`lib/axiom/agentRuntime/repositoryEvidenceRedaction.ts`), and desktop log redaction (`desktop/security.md`). These are pattern-based; they reduce, not eliminate, leakage.

### Environment handling

- Secrets live in Vercel environment variables and are read with `process.env` in many modules (vault, desktop signer, NextAuth, Stripe, Resend). Values are not repeated here.
- Fallback chains (vault key → other secret; desktop key → NextAuth secret) mean a missing variable silently widens the blast radius of another secret instead of failing closed (**gap**).

### November 2026 public-repository key exposure

- The repository was exposed publicly in November 2026 with live keys in it. The user reports the Stripe and Resend keys were rotated. **This document did not independently verify the rotation, did not check whether other secrets (database URL, NextAuth secret, vault key, desktop signing key, provider app private keys, AI provider keys) were in the exposed history, and did not check git history scrubbing.**
- Important consequence: if the vault encryption key or the NextAuth/desktop signing secret was ever in the exposed tree, rotation of Stripe/Resend alone is not sufficient. Every stored ciphertext and every issued session/desktop token would need to be treated as compromised.

---

## 5. Tools and AI agent actions

### Tool registry and grants

- `lib/axiom/agentRuntime/tools.ts` `TOOL_REGISTRY`: each tool has a `riskLevel` (`low | medium | high`).
  - Low (read-only): Airflow DAG/run/task reads, Microsoft docs search, cloud account list, AWS inventory read, environments/integrations/deploy status lists, GitHub file list/read/search/inspect, SCIM lifecycle preview.
  - Medium (write, proposal-only): `create_environment`, `create_github_branch`, `commit_github_file(s)`, `open_github_pull_request`.
  - High (write, proposal-only): `configure_deployment_target`, `connect_identity_provider`, `trigger_aws_deploy`.
- Per-tenant grant: Prisma model `WorkspaceAgentIdentity` (`organizationId` primary key, `enabled` default **false**, `allowedTools` JSON default empty). `lib/axiom/agentRuntime/agentIdentityPolicy.ts` `normalizeAgentIdentityInput` only accepts names present in `TOOL_REGISTRY` and refuses enabling with zero tools.
- `lib/axiom/agentRuntime/decisionLoop.ts`: tools offered to the model are the intersection of profile and workspace grants (`profileToolNames`); the grant is re-read and a revoked tool is refused mid-loop; only `riskLevel === "low"` tools run immediately; write tools produce an unexecuted proposal ("Execution still requires separate human approval").

### Approval and independent review

- `lib/axiom/agentRuntime/browserApprovalDecision.ts`: refuses `self_approval_forbidden` (proposer cannot approve its own action), `approval_expired`, `proposal_integrity_failed` (see `proposalIntegrity.ts`), `agent_tool_not_allowed`, `workspace_agent_disabled`, and requires approval authority (`canDecideApprovals` in `lib/auth/platformAdmin.ts`).
- Limits: "independent" means a different user id in the same workspace. A single person with two accounts, or a small team, can satisfy it. Real independent human decisions are still listed as open in T10.
- Desktop cannot bypass web approval; signed handoff issuance is refused (`desktop/security.md`).

### Prompt injection and exfiltration

- Hostile repository, ticket, document or cloud-tag text reaches the model as context (T07). The system prompt tells the model to treat observations as facts, not instructions, and profile text "cannot expand workspace policy". These are prompt-level mitigations, not enforcement.
- What actually bounds damage: the model cannot execute writes (proposal + human approval), read tools are tenant-scoped and grant-limited, and the model has no general network fetch tool in the registry.
- Remaining exfiltration paths: (a) a malicious instruction can make the model put secrets/private code into a proposal (e.g. a commit or PR body) that a tired reviewer approves; (b) model output rendered in the UI could carry links/markdown that leak data when clicked (rendering sanitization **unverified**); (c) all context goes to the AI provider, so provider-side retention is outside our control (data-processing terms **unverified**). No adversarial prompt-injection evaluation has been run (T07).

### AI credit holds

- `lib/billing/aiCreditReservation.ts` `reserveAICreditsInTransaction`: in a transaction, computes `pool - used - held` (pool from plan + add-on purchases; held includes `reserved`, pending settlement and `dispatch_unknown`) and refuses with `ai_credit_pool_exhausted` if the request does not fit. Comment dated 2026-11-08: "Never beyond prepaid ... every tier hard-stops"; legacy metered/soft-warn/custom-contract modes no longer admit usage beyond balance.
- Holds expire after a TTL; unknown dispatch outcomes stay held rather than being released as zero (T09).
- Gaps: correctness under true concurrency depends on the transaction isolation level and locking (not verified by test against Neon here); the legacy bot path (T11) uses a separate message allowance and is not proven to pass through this reservation.

---

## 6. STRIDE table per boundary

Status key: **Impl** = code seen doing it; **Partial** = exists but coverage incomplete; **None** = not implemented; **Unver** = not checked.

### B1/B2 Browser to web app

| STRIDE | Threat | Existing control (file) | Residual risk | Status |
| --- | --- | --- | --- | --- |
| S | Stolen session cookie | NextAuth JWT, 30-day maxAge (`lib/auth.ts`) | No server-side revoke; long lifetime | Partial |
| S | Unverified email sign-in (password) | `emailVerifiedAt` required (`lib/auth.ts`) | OAuth email verification not checked | Partial |
| T | CSRF on mutations | `isSameOriginRequest` (`lib/auth/requestOrigin.ts`) | Route coverage | Unver |
| R | User denies an action | Best-effort audit (`lib/security/auditLog.ts`, T14) | Audit writes can be dropped | Partial |
| I | XSS leaks data | React escaping; 3 `dangerouslySetInnerHTML` uses (JSON-LD, handbook) | Handbook regex HTML from static content; CSP not reviewed | Unver |
| E | Member escalates to admin | Roles from accepted membership (`currentContext.ts`); admin email allowlist (`platformAdmin.ts`) | No MFA/step-up for admin | Partial |

### Tenant boundary (B2/B5)

| STRIDE | Threat | Existing control | Residual risk | Status |
| --- | --- | --- | --- | --- |
| S | Select another workspace by cookie | Membership re-checked per request; no org id if no accepted role (`currentContext.ts`) | None known for this path | Impl |
| I | IDOR read of another tenant's record | Hand-written `organizationId` filters; helpers in `tenantIsolation.ts` barely used | Any missed filter leaks data; no RLS backstop | Partial |
| T | Cross-tenant write | Same as above | Same | Partial |
| I | Demo data shown in real workspace | `assertNotDemoLeak`/`isSandboxWorkspace` (`workspaceKind.ts`) | Not every mock path inventoried | Partial |
| I | Background jobs mix tenants | Data-driven scope | Not inventoried | Unver |

### B3 Desktop app

| STRIDE | Threat | Existing control | Residual risk | Status |
| --- | --- | --- | --- | --- |
| S | Forged desktop token | HMAC, constant-time compare (`desktopToken.ts`) | Key may fall back to NextAuth secret | Partial |
| S | Stolen desktop token | Durable session TTL ≤30 days, revoke (`desktopSession.ts`), membership re-check (`desktopSessionResolverCore.ts`) | Token stored on device; keychain storage planned | Partial |
| E | Desktop bypasses approval | Signed handoff refused; local execution disabled (`desktop/security.md`, `handoffValidator.ts`) | Holds while disabled | Impl |
| T | Tampered installer | Release metadata only (T13); code signing planned | Unsigned builds | None |
| I | Secrets in desktop logs | Canonical redaction (`desktop/security.md`) | Pattern-based | Partial |

### B4 Public API `/api/v1`

| STRIDE | Threat | Existing control | Residual risk | Status |
| --- | --- | --- | --- | --- |
| S | Guessed/stolen key | Hashed storage, constant-time compare (`apiKeyCrypto.ts`) | Optional expiry; no IP binding | Partial |
| E | Key used beyond scope | Closed-union scopes (`apiKeyScope.ts`, `authenticateApiKey.ts`) | `*` grant admin check unverified | Partial |
| R | Key misuse untraceable | Denial audit in `authenticateApiKey.ts` | Best-effort | Partial |
| D | Request flooding | `lib/api/rateLimiter.ts`, `rateLimitBudget.ts` | Per-route use and multi-instance behaviour | Unver |

### B6 AI gateway and providers

| STRIDE | Threat | Existing control | Residual risk | Status |
| --- | --- | --- | --- | --- |
| T | Prompt injection drives writes | Writes are proposals; self-approval forbidden (`decisionLoop.ts`, `browserApprovalDecision.ts`) | Reviewer may approve a poisoned proposal | Partial |
| I | Data exfiltration via model | Tenant-scoped, grant-limited read tools; no fetch tool | Exfil via proposal text, rendered links, provider retention | Partial |
| E | Model uses ungranted tool | Grant intersection and mid-loop re-check (`decisionLoop.ts`, `agentIdentityPolicy.ts`) | — | Impl |
| D | Overspend / runaway cost | Prepaid hard-stop holds (`aiCreditReservation.ts`) | Legacy bot path (T11); concurrency not tested on Neon | Partial |
| I | Secrets in AI logs | Redaction (T12) | Pattern-based | Partial |

### B7 Connected providers

| STRIDE | Threat | Existing control | Residual risk | Status |
| --- | --- | --- | --- | --- |
| I | DB dump reveals provider tokens | AES-256-GCM vault (`credentialVault.ts`) | Single env key; legacy envelope lacks context | Partial |
| T | Ciphertext swap across connections | AAD context in scoped envelope (`credentialVaultCrypto.ts`) | Legacy rows | Partial |
| S | OAuth state replay | One-use state + PKCE on Outlook path (T04) | Other providers not checked | Partial |
| E | Over-broad provider grants | Read-grant checks for GitHub (T06) | Cloud role scope chosen by customer | Partial |
| R | Unknown outcome repeated | Durable unknown history (T09, A3 note) | — | Partial |

### B8 Stripe

| STRIDE | Threat | Existing control | Residual risk | Status |
| --- | --- | --- | --- | --- |
| S | Forged payment webhook | `constructEvent` signature check in both webhook routes | Idempotency of credit fulfilment (`aiCreditFulfillment.ts`) not traced | Partial |
| I | Leaked Stripe key | Rotated per user report | Rotation not independently verified | Unver |

### B9 Build and deploy

| STRIDE | Threat | Existing control | Residual risk | Status |
| --- | --- | --- | --- | --- |
| I | Secrets committed to repo | Env vars on Vercel | Nov 2026 public exposure; full history scope unknown | Unver |
| T | Malicious dependency | `lib/security/supplyChain.ts` exists | No lockfile/SCA review done here | Unver |
| E | Silent secret fallback | — | Vault and desktop keys fall back to other secrets | None |

---

## 7. Open gaps and recommended next steps (highest risk first)

1. **Confirm the scope of the November 2026 exposure.** List every secret that ever appeared in the public history (not just Stripe/Resend). If the vault key, NextAuth secret, desktop signing key, database URL, GitHub App key or AI provider keys were present, rotate them, re-encrypt stored credentials, and force all sessions/desktop tokens to re-issue. Record the verification, not just the user's statement.
2. **Make tenant scoping structural.** Either adopt a Prisma client extension that injects `organizationId` for tenant models, or Postgres RLS on Neon, and/or route all handlers through one guard. Then run two-tenant negative tests on every route that takes a record id. Until then, IDOR is the most likely real-world data leak.
3. **Remove secret fallbacks.** Require a dedicated vault key and a dedicated desktop signing key; fail closed when absent.
4. **Add revocation for browser sessions.** Shorten the 30-day JWT, or add a server-side session version checked in `currentContext()`, so logout, password reset and compromise response actually end sessions. Add MFA/step-up for platform-admin and approval roles.
5. **Strengthen approval independence and proposal review.** Show full diffs/args with injected-content warnings; consider two-person approval for high-risk tools (`configure_deployment_target`, `connect_identity_provider`, `trigger_aws_deploy`). Run an adversarial prompt-injection evaluation (T07).
6. **Migrate legacy credential envelopes** to the scoped envelope and plan key versioning.
7. **Qualify the legacy bot path (T11)** against the prepaid hard stop and tenant ownership.
8. **API keys:** enforce a maximum lifetime; verify the admin check for `*`.
9. **Inventory demo-data producers** and confirm each is guarded per the CLAUDE.md rule; add a test that real ids never reach them.
10. **Desktop:** ship OS keychain storage and code signing (both planned).
11. **Commission the independent assessment / penetration test (A7.14)** once items 1-3 are done.
