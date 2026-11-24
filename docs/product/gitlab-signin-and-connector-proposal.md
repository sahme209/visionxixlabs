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
The unpublished scoped reader takes a context-encrypted project token and
rechecks current consent before and after the bounded GitLab.com read. Reads
target the numeric GitLab project ID recorded in both the credential and the
workspace grant. The owner and repository names still have to match the workspace
repository binding. Pure payload projection can be reused. The public connector
catalog labels GitLab planned. The staged database adapter reads accepted
membership, provider scope, the workspace repository and consent in a short
consistent snapshot before and after transport. It requires the authenticated
caller to supply a canonical user ID and the reviewed repository-read decision.
Route adoption, durable validation and separate live qualification remain open.

## Evidence persistence

The staged sync collects one bounded slice before opening a write transaction.
The transaction locks the exact workspace membership, repository and consent,
rechecks their binding, and saves the complete slice or rolls it back. It
reports uncertain commits separately. The gated dashboard sync requires a
same-origin request, canonical session identity and current connection-manager
access. It uses the exact active workspace registration and records the existing
repository audit event after a confirmed sync. Customer-facing setup and live
qualification remain open.

## Provider validation evidence

The staged scope check uses GitLab's authenticated
[self-information endpoint](https://docs.gitlab.com/api/personal_access_tokens/#self-inform).
It requires an active, unrevoked token with exactly `read_api`, an unexpired
provider expiry (midnight UTC), and unambiguous token and user IDs. It makes no database
transition. GitLab stores project and group tokens as personal access token
records, so self-information alone cannot prove the selected project owns the
token. A successful project GET is also insufficient because public projects
can answer anonymously, and GitLab documents access to Internal projects for
some project tokens. The staged project check compares token ID, bot user ID,
scope and expiry with the [exact project's token record](https://docs.gitlab.com/api/project_access_tokens/#retrieve-details-on-a-project-access-token).
It reads the numeric project's metadata and requires the canonical
`path_with_namespace` to match the workspace repository. The separate verifier
credential is used only for the project-token lookup.

For an existing pending registration, the staged activation transaction locks
and rechecks the exact workspace membership, repository and consent revision.
Only the consenting connection manager can finish activation. The stored
project credential's expiry never extends beyond the pending or provider expiry.
The authenticated dashboard setup endpoint is disabled by default. Its
same-origin POST accepts an exact pending registration or a validation request.
The credential envelope binds the workspace, connection and repository. The
verifier is request-scoped and is not persisted. Its scoped GET returns only
status, connection ID, revision and validation time so an authorized manager
can reload after an unconfirmed reply. A consenting manager can revalidate an
unexpired active credential against fresh project and token evidence. A current
workspace manager can revoke an exact registration revision in V19, which
removes the stored usable credential without sending a GitLab mutation.
Reconnect requires an explicit new credential and the revoked revision.
In a workspace where setup is enabled, open the tracked GitLab repository in
V19 Control → Integrations → Manage GitLab. Register the scoped project token, then supply the
separate verifier to validate it. Sync controls appear after recorded read
validation. Refresh status to recover an uncertain result. Revocation requires
confirmation and affects the V19 connection. Live credential custody and hosted
qualification remain open.

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
