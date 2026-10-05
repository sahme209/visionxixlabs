# Enterprise Identity Design — OIDC/SAML, MFA, SCIM

Status: **design only. Nothing in this document is implemented or configured.**
No real identity provider is connected. No code in this repo currently reads
or writes any of the models/flows described below. Do not describe any part
of this as live, available, or enabled until it has shipped, been reviewed,
and has CI-verified tests exercising it.

## Why this exists now

`OrgMembership` (`prisma/schema.prisma`) is the only membership model today —
email/password or OAuth (GitHub/Google) via NextAuth, one flat `OrgRole`
enum, no concept of an external identity provider, no SCIM, no per-tenant
MFA requirement. This document is the least-privilege design for adding
enterprise SSO without it becoming a second, parallel, inconsistent
authorization system.

## Principles (non-negotiable, carried from the existing security baseline)

- **Least privilege.** An SSO-provisioned user gets exactly the role their
  IdP assertion/SCIM payload maps to — never a default elevated role, never
  "owner" unless explicitly mapped.
- **Fail closed.** If SAML/OIDC assertion validation fails, if a role
  mapping is missing, or if MFA is required by tenant policy and absent
  from the assertion, deny sign-in. Never fall back to a weaker auth path
  silently.
- **Tenant isolation.** One `TenantIdentityProvider` row per
  `(organizationId, provider)`, mirroring the existing
  `TenantIntegrationConnection` unique-key pattern. A SAML assertion issued
  for tenant A's IdP entity ID must never be accepted for tenant B.
- **No fabricated state.** Connection status is `not_configured` by default;
  it becomes `active` only after a real metadata exchange and a real test
  assertion round-trip succeed — never on save of a config form alone.

## Proposed schema (new models, additive — no change to existing `User`/`OrgMembership`)

```prisma
enum IdentityProviderProtocol {
  oidc
  saml
}

/// pending | active | needs_attention | revoked — same closed-union
/// convention as TenantIntegrationConnection.status.
model TenantIdentityProvider {
  id                String                    @id @default(cuid())
  organizationId    String
  protocol          IdentityProviderProtocol
  status            String                    @default("pending")
  /// OIDC issuer URL or SAML IdP entity ID. Used to bind an incoming
  /// assertion/token to exactly one tenant — the #1 cross-tenant risk
  /// in any multi-tenant SSO design.
  issuerOrEntityId  String
  /// SAML IdP metadata XML or OIDC discovery document, stored verbatim
  /// for audit/debugging. Never contains a credential.
  metadataDocument  String
  /// Domain(s) this IdP is authoritative for (e.g. "acme.com"). A user
  /// signing in with a matching email domain is routed to this IdP
  /// instead of password/OAuth — never both paths silently accepted.
  managedDomains    String[]
  roleMappingJson   Json      /// IdP group/claim -> OrgRole. No default role.
  requireMfaClaim   Boolean   @default(true)
  lastTestAssertionAt DateTime?
  configuredByUserId  String
  revokedAt           DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([organizationId, protocol])
  @@index([organizationId, status])
  @@index([issuerOrEntityId])
}

/// SCIM-provisioned identity record — separate from OrgMembership so a
/// deprovisioned SCIM user can be distinguished from a manually-removed
/// one in the audit trail, and so SCIM sync failures never silently
/// delete a membership row outright.
model ScimProvisionedIdentity {
  id                String   @id @default(cuid())
  organizationId    String
  externalId        String   /// IdP-assigned stable user id.
  email             String
  orgMembershipId   String?  /// Null until first successful role-mapped login.
  scimActive        Boolean  @default(true)
  lastSyncedAt      DateTime @default(now())
  deprovisionedAt   DateTime?

  @@unique([organizationId, externalId])
  @@index([organizationId, email])
}
```

## Sign-in flow (OIDC)

1. User enters email. Server looks up `TenantIdentityProvider` by matching
   `managedDomains` against the email's domain — **not** by letting the user
   pick a provider, to prevent IdP-mixing attacks.
2. If no matching active provider: fall through to existing NextAuth
   password/OAuth, unchanged.
3. If a matching active provider exists: redirect to the IdP, exchange the
   code, validate the ID token's `iss`/`aud`/signature against the stored
   `issuerOrEntityId` and discovery document — reject on any mismatch.
4. If `requireMfaClaim` is true and the token's `amr`/`acr` claims don't
   indicate MFA was performed at the IdP: deny with a specific reason code
   (`sso.mfa_required_not_present`), never silently downgrade.
5. Map claims to an `OrgRole` via `roleMappingJson`. No match → deny with
   `sso.no_role_mapping`, never default to `read_only` or any other role.
6. Upsert `OrgMembership` with the mapped role, `acceptedAt` set to now.

## Sign-in flow (SAML) — same shape, different validation

Signature validation against the stored IdP metadata's signing certificate,
`Destination`/`Audience`/`InResponseTo` checks against the request that
initiated the flow (replay prevention), then identical domain-routing,
MFA-claim, and role-mapping steps as OIDC above.

## SCIM lifecycle boundaries

- **Provisioning**: SCIM `POST /Users` creates a `ScimProvisionedIdentity`
  row only — never an `OrgMembership` directly. The role is assigned on
  first successful SSO login via the mapping above, not by SCIM itself
  (SCIM group payloads are not always trustworthy role sources across
  every IdP; first-login role mapping through the already-validated
  assertion is the single source of truth).
- **Deprovisioning**: SCIM `DELETE`/`PATCH active:false` sets
  `scimActive: false` and `deprovisionedAt`, and immediately invalidates
  any live session for that user (see session revocation below) — but does
  **not** delete the `OrgMembership` row outright, so the audit trail shows
  "deprovisioned via SCIM on <date>" rather than the membership simply
  vanishing.
- **Sync failures fail closed on the access side, not the data side**: if a
  SCIM sync job errors, existing access is neither revoked nor extended
  automatically — the failure itself is audited and alerted; access changes
  only ever apply once a payload is actually, successfully processed.

## Session revocation

Reuses the exact pattern already proven in `lib/desktop/desktopSession.ts`
this session (tested in `app/api/desktop/session/__tests__/route.test.ts`):
a `revokedAt` timestamp, `statusFor()`-style derivation (never a mutable
boolean flag that can be "un-set" accidentally), and revocation that takes
effect immediately on the next request, not on next token expiry. SSO
session revocation additionally fires on: SCIM deprovision, IdP connection
being set to `revoked`, and role-mapping change that would reduce a user's
current role (session is revoked, user is forced to re-authenticate and
get the new mapped role rather than keeping stale elevated access).

## Audit evidence

Every state transition above (`TenantIdentityProvider` created/activated/
revoked, SCIM provision/deprovision, role-mapping change, MFA-claim denial,
cross-tenant assertion rejection) writes an `AuditEvent` via the existing
`lib/audit/secureAudit.ts` boundary with a correlation ID, following the
same closed-union `AuditAction` convention already in place — new action
names would be added there, e.g. `identity.sso_configured`,
`identity.sso_assertion_rejected`, `identity.scim_deprovisioned`.

## Explicitly out of scope for this document

- Building the actual SAML/OIDC client code.
- Registering with any real IdP (Okta, Entra ID, etc.).
- UI for configuring this in `/dashboard`.

Those are implementation phases that follow this design, each needing its
own CI-verified tests before any claim of availability.
