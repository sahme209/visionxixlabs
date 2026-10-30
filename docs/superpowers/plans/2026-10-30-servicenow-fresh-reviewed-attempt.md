# ServiceNow fresh reviewed attempt implementation plan
Goal: permit one explicitly reviewed child of an exact known pre-write refusal, without resetting its parent.
Spec: docs/recovery/2026-10-29/servicenow-fresh-reviewed-attempt-blueprint.md (user approved local implementation).
Execution: inline under executing-plans. No deployment, paid CI, provider write or human decision is included.
Architecture: optional strict link-only freshAttempt reference, immutable parent locks/history checks in existing lifecycle store, stable logical note marker, separate deterministic child action identity. Request-bound read-only absence proof before preparation; normal transport checks absence again before writing. Existing approval/clock/one-attempt mechanisms own the child.

## Task1 identity and store
- Pure helper serviceNowFreshLinkAttemptId and verifyServiceNowFreshLinkParent with immutable parent ID/version/candidate digest, no retry chain, exact logical intent, same owner/executor, refused/providerfalse/attempt1/provider mode only.
- TDD negative statuses, null/true write, consumed parent child, changed parent/target/payload/executor, identity determinism.
- Extend only link candidate/review with optional strict freshAttempt. Store validates parent under existing row lock/history at every prepare/approval/claim/pre-dispatch/finish and never changes it. Creation requires trusted request-bound absence receipt; uninstalled ports fail closed. Preserve existing legacy IDs.
- Transport validates child identity while retaining the original exact logical note marker and strict journal verifier.

## Task2 trusted server and UI
- Read-only exact proof check and prepare-child actions through existing request composition; reject unsafe parent before any proof network request, recheck parent under locks before child creation.
- New child uses fresh association, native source checks and separate independent approval. No automatic dispatch or retries. Show parent and consumed history in native review; require deliberate preparation and verification.
- Tests cover parent race, preexisting note, missing receipt, expired/revoked authority, child uniqueness, consumed-child refusal, unknown outcomes and no writes from reads.

## Task3 verification and batch
- Focused tests plus actual isolated PostgreSQL lifecycle journey with simulated provider (not live acceptance), types/build, final independent review, signed local app.
- Preserve sources/receipts/bundle and private backup. Prepare one concrete activation/release review with remaining CI budget and Windows gates. Actual provider write and final human approvals stay separate.
