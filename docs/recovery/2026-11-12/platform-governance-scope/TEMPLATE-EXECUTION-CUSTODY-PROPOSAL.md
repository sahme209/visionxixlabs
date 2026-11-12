# Template execution receipts and recipient-bound access delivery — owner review

Status: proposed LOCAL extension only. No implementation/execution/production authority. P01 remains incomplete; current prepared template workflow has no execution command. Original unknown histories remain consumed.

## Why this boundary is needed

Source inspection on f0dd0849 shows:

- `runPlatformEffect` records generic outcome before returning a transient value. The template helper returns bucket metadata, an uploaded object's VersionId, or a signed bearer URL. Dedicated action/effect history does not retain those typed results. A timeout after a real write therefore cannot be treated as a safe new action or reconstructed as a known object version.
- Native cross-action reservations currently cover growth post/delete, not template resources. A new request UUID is correlation, not permission to repeat an unknown effect.
- `recipientDigest` in current prepared access selections is caller-entered metadata. It does not authenticate the intended recipient, prevent sharing or authorize final URL delivery.
- The existing scoped credential envelope can authenticate record-specific ciphertext. Encryption does not establish host/key custody or make an output URL nontransferable.

These are source findings, not reproduced live incidents. No real AWS request, credential or URL was inspected.

## Approaches and proposed choice

1. Return raw helper results after generic outcome recording: inadequate durable recovery and secret-delivery binding; reject.
2. Keep template execution unavailable permanently: containment only, not completion.
3. Recommended: exact private typed receipts and clone-resistant resource reservations, plus a separate encrypted one-use grant-delivery record tied to the original requester. This reuses the current platform/DB/scoped-envelope architecture; no new library/service/key is proposed.

The recommended choice is a proposal for owner approval, not a decision already granted. Existing image/deployment proposals and their pending permissions are separate.

## Supported workflow and requested-target meaning

Keep bucket creation, object upload and version access as separate independently reviewed plans. No automatic bucket creation/upload/versioning/ACL change follows a read or an access request. Creation stays us-east-2 only; object/access retain the qualified current region profiles. Current paired platform privilege, genuine distinct reviewer, exact source, expiry, original requester/session and one parent/child attempt are unchanged.

Saving/previewing does not observe account ownership, bucket absence or version presence. Actual execution still requires final STS identity, expected bucket owner, observed enabled versioning, conditional content-addressed upload and exact version/readback. Never use a HEAD failure as absence proof. Keep SDK maxAttempts1, fixed endpoints, redirect refusal and bounds.

## Durable resource reservations

Reserve before the corresponding write/grant issuance can begin, in the original action transaction with current authority and DB-time checks. New opaque reservation records are LOCAL schema/fixture definitions only.

- Bucket creation identity: canonical AWS account + bucket name + operation. Exclude region (bucket namespace is not a fresh resource when a region changes), action/request UUID, actor/session and profile version. Only us-east-2 is permitted anyway. A confirmed creation remains a permanent historical reservation; normal later operations use the existing bucket rather than re-create it. External deletion/re-creation recovery is unsupported and must not reset this record.
- Conditional object upload identity: account + bucket + canonical content-addressed object key + operation. Exclude random IDs, region, actor/session and profile version. Confirmed exact versions may be used by later separately reviewed access plans. Unknown upload cannot be cloned through a different action; a new digest is a different requested object, not evidence about the old one.
- Access issuance identity: account + bucket + key + exact object version + actual stable requester user ID + operation. Exclude action/request UUID, requester session, entered digest, TTL/review expiry and profile version. A new session cannot bypass uncertainty for the same recipient/resource. The original session still binds delivery authority.

Unknown/pending/ambiguous reservations stay held. Expiry/cancellation of an approval, lack of a response or a changed request ID never releases them. No automatic retry, cleanup or recovery chain.

For useful future access, only an issued grant with a DURABLE, validated hard expiry may permit a later generation after that expiry plus the independently qualified clock-skew margin. The issuer checks signed date/TTL against locked DB time and records the exact hard expiry; missing/invalid/unqualified clock/profile evidence refuses this release. This is a new generation with a fresh exact plan and genuine review, never renewal of the old approval. Unknown issuance without a qualifying durable expiry stays blocked until a separately reviewed proof-based recovery design. Old receipt/history is immutable.

## Typed private observation and result history

Extend the actual private effect runner/service observation boundary, not an arbitrary JSON endpoint. Its one-use opaque send/observation capability must bind original action/effect index/plan/source/reservation generation and exact validated transport result. Construct it only in the real template adapter after final authorization and bounded response checks; client JSON cannot supply outcome, provider receipt, owner or epoch.

Atomically persist the result, child terminal outcome, parent transition and append-only event in one SQL transaction. A failed/unknown commit consumes the attempt; no output secret/usable result is released and no replacement action is inferred safe.

- Bucket receipt: exact target plus bounded successful creation status; not a claim about current/public access or later resource state.
- Object receipt: exact target/content digest, observed enabled versioning, successful status and non-null exact VersionId. Missing/contradictory version evidence remains consumed/unusable for access; do not invent a version from metadata.
- Access receipt: exact target, original requester/session, grant-reference ID, signed-date/TTL/hard-expiry metadata, reservation generation and protected artifact reference. The complete signed URL and credential-bearing query/path material never enter action/event/history/preview JSON or logs.

Read-only result history returns bounded validated metadata only under current platform reader authority. It never renews approval, returns a secret, supplies missing receipt evidence or turns unknown into success. Existing rows stay unchanged; no backfill/repair SQL.

## Actual recipient and encrypted grant

For v1, access is delivered only to the ORIGINAL authenticated requester in the ORIGINAL session. Replace the unimplemented caller-entered recipient-digest preparation profile with an explicit `original_requester_session` selection. Derive the public target's recipient digest server-side from purpose + actual requester user/session; never accept an arbitrary digest as recipient authority. Old metadata-only plans remain historical and cannot be silently upgraded to this executable profile. Review UI explains original-requester delivery and transferability; no fabricated recipient identity.

Generate a predetermined opaque grant reference from the original preparation lineage before plan compilation. Its nonsecret reference/profile metadata can participate in the plan without hashing a URL or creating an artifact/plan-digest cycle. After exact plan compilation and issuance, scoped authenticated encryption binds URL ciphertext to purpose, grant ID, original action/plan/effect, reservation epoch, exact target/version/content, requester user/session and hard expiry. Copying across any context must fail. Use only existing scoped crypto with synthetic test keys; actual supplier/key/host qualification remains separate.

Persist the encrypted URL and receipt atomically with the confirmed issuance observation. URL signing alone is not client delivery or proof the client received it. If recording fails or times out, do not release URL, re-sign or retry. No plaintext persistent storage, URL-derived public digest, raw provider errors, token/query logging or arbitrary ciphertext adoption.

## One-use delivery and expiry semantics

Delivery is authorized by the same exact reviewer-approved access plan and original requester's explicit one-attempt confirmation; no second timed human handoff. A separate durable one-use delivery claim references that exact stored grant/epoch. Before decrypting/releasing it, check current requester possession/session/role, current reviewer/source, original approval expiry, current grant/profile/key context and hard expiry around awaits. Recheck current authority after outcome recording too. Revocation or expiration before release blocks output, retaining history/liability. Never return a secret through the read-only history endpoint.

Deliver only through the qualified current authenticated response/native channel. Claim delivery before releasing bytes, once; lost response is delivery-unknown, not permission to fetch again. UI may hold the URL transiently only for the intended operation, never log/persist it or claim it is nontransferable. No automatic opening or external navigation is included in local implementation authority.

Approval expiry governs when issuance/delivery may occur. A successfully delivered grant can remain valid for its explicitly reviewed TTL after that review window ends; the UI shows grant hard expiry separately and does not imply that approval expiry revokes an issued URL. Any live delivery/channel acceptance stays separately authorized.

## Concrete local implementation batch if approved

1. Closed receipt/reservation/grant/delivery contracts and exact recipient-profile migration in source definitions; old profiles remain non-executable history.
2. Proposed local schema/fixtures and actual owned isolated SQL cases: uniqueness/generation/current authority, concurrent claims, atomic receipt/event rollback, unknown commit, immutable old history, known-expiry versus unknown release.
3. Actual template adapter/private observation composition, scoped synthetic encryption and original-session delivery. All default profile/clock/channel/key suppliers refuse until their real source qualification is established. No fake qualified supplier in production composition.
4. Joined prepared client/UI tests for proposal→exact review→requester confirmation→typed history and one-use grant delivery, including source/role/session/reviewer revocation, lost/malformed SDK results, digest/version/epoch/recipient/ciphertext substitution, expired/unknown liabilities, output bounds and no URL/credential leakage. Providers and keys are synthetic; distinguish actual isolated SQL.
5. Full original P01 requirements/caller audit, whole-branch review/types/tests/build and mandatory green PR. No standalone guard-only completion, route activation or claim of full Governance.

## Scope requested from owner

Approve local code, additive schema definitions, existing scoped crypto with synthetic keys, mocked provider/client tests and the existing owned isolated PostgreSQL fixture for this new reservation/recipient/output boundary. No production SQL, database repair, live AWS call, real credential/key/Keychain read, service/account/grant change, actual secret delivery/navigation, signing, installation, route/flag activation, deployment, paid CI or spending. Real profile/clock/key/host/channel qualification remains separate; this approval would not consume or replace other pending decisions.

## Independent design check

A fresh read-only builder check of this document and actual template/private runner/store/preparation source found nothing important unanswered for planning the proposed LOCAL batch. It confirmed that issuance/delivery are separate, unknown liabilities stay held and real profile/clock/key/channel qualification remains closed. No implementation, tests, database/provider operation or approval was performed by that check.
