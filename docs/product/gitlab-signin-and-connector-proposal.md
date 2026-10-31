# GitLab sign-in and connection — draft for later review

Status: requested, design draft only. No implementation, registration, consent,
credential, production flag or provider operation is authorized by this document.
The current user priority remains completing existing workflows and Releases UX.

## Two distinct capabilities

1. **Sign in with GitLab:** establishes Axiom identity and resumes the same safe
   internal callback/desktop-pairing flow. It grants no repository access.
2. **Connect GitLab to a workspace:** separately authorized, tenant-scoped source
   control and CI context. Start with bounded read-only project/MR/pipeline data;
   governed writes are a later exact-action capability, not implied by login.

Initial recommendation (not yet an agreed platform restriction): gitlab.com
first, with self-managed instances a separately reviewed allowlisted-host design.
Never accept arbitrary identity issuers/provider URLs or redirect destinations.
Exact scopes, verified-identity claims and endpoint limits must be confirmed
against current official provider documentation before implementation/consent.

## Current source observations

`lib/auth.ts` registers Google/GitHub/Cognito and credentials, not GitLab. Its
OAuth callback includes email-based user bootstrap. GitLab must not simply be
added to that branch without verifying stable issuer/subject ownership and a
safe account-linking rule. Linking to an existing Axiom account requires proof
of that existing account; matching email alone is not permission to link.

`lib/releaseops/gitlabFetcher.ts` and pure GitLab projectors already exist.
The raw fetcher permits process-wide token/base-URL fallbacks and unbounded JSON
reads; customer connection work must verify/use a tenant-scoped, bounded adapter,
not expose those defaults. Pure payload projection can be reused. The connector
catalog currently labels GitLab planned; this is not live acceptance.

## Required reviewed behavior

- Existing account/workspace/session/SSO/seat policies remain authoritative.
- Login and connector grants/credentials stay separate and privately stored.
- No auto-link by email, cross-tenant token fallback, response-body logging,
  credential prompts in chat, new role grant or automatic provider write.
- Unknown/denied/partial collection remains explicit; no absence/compliance claim.
- Preserve exact independent approvals, durable claims, uncertainty and recovery
  for any subsequently implemented action.
- Test issuer/subject crossover, malicious callback URLs, revoked access,
  missing/ambiguous identity claims, existing-account linking and interrupted
  desktop pairing. Real provider setup and live sign-in are separate acceptance.

Local implementation requires the user's validation-first design approval;
provider registration, credentials/permissions, deployment and live actions remain
separate exact approvals under the existing restrictions.
