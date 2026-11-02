# Native Git credential lifetime and enrollment — local design for review

## Concrete remaining gap

The existing native push path exports a repository-wide GitHub installation bearer. New issuance now checks current unenrolled authority, but a previously returned token can remain usable after later baseline enrollment. A branch-name check is not a token permission boundary. Clone/pull now use contents_read and do not need a mutation lease. Production activation must remain refused while this gap is unresolved.

## Proposed local contract

Reuse existing durable workflow/event/audit tables, with a separately typed immutable credential-lease record. Bind server-authenticated organization, actor/session, exact repository and installation revision, push purpose, server nonce and recorded protocol revision. Never persist token/clone URL/credential payload. New token grants or broader provider permissions are not part of this change.

Before invoking the existing provider resolver, reserve a pending lease under the same organization advisory lock as enrollment, with current paired authority and positive unenrolled absence. Perform token resolution outside database locks. Extend the internal resolver result to retain the provider-returned expiration already validated by githubAppAuth; do not guess a fixed lifetime or invent expiry from the caller. Under the same org lock, recheck current authority, installation revision and positive absence, then finalize the exact reservation as issued with that trusted expiration before returning the credential. No existing approval/action is consumed or reinterpreted by a lease.

Lost provider or database acknowledgment remains pending/unknown and blocks enrollment. A canceled or failed request does not silently mean no token was minted. Never automatically expire an unknown issuance, clear it because of a timeout, reset its history, or replay token minting as recovery. Metadata-only reads may explain the blocker. Known issued leases cease blocking only after the recorded provider expiration using the database clock; an independently verified future revocation path would require separate design/authorization and append-only evidence.

Coverage/enrollment checks read all relevant live/pending/unknown leases under the org lock. They cannot race a new reservation: issuance-before-activation blocks activation; activation-before-issuance refuses issuance. Current authority, real baseline/numeric/action review, evidence and one-attempt guards remain separate requirements. Missing/malformed lease records or unknown protocol status never grant coverage.

## Legacy and mixed-runtime boundary

There are already untracked tokens and potentially older issuer runtimes. Empty lease history is NOT proof of absence. Existing installations remain legacy-issuance-unqualified; no SQL backfill, inferred expiry, checkbox acknowledgment or guessed grace period may qualify them. A subsequent concrete rollout/drain plus provider-backed expiry/revocation/installation-generation proof must be separately designed and accepted before their activation can succeed. This package must expose that unresolved gate, not fabricate proof or claim complete native coverage. No production setting or grant changes are authorized by approving local implementation.

## Required evidence

TDD strict contract/history tests; real owned socket-only PostgreSQL both lock orders; current participant/installation revocation; cancellation/expiry through awaits; malformed/long/missing provider expiry; resolver response loss/finalization loss; cached-token overlapping leases; no secret in records/audits/errors; no network under locks; no caller truth flags; legacy absence always refuses. Retain clone/pull read-only and existing native push behavior only for positively unenrolled and properly reserved issuance. Genuine live provider, deployment, legacy transition qualification and activation acceptance remain separate.

This proposal requests LOCAL code and simulated/provider plus isolated-database tests only. No schema migration, deployment, real token mint/revocation, grant, CI, purchase or human decision is included.
