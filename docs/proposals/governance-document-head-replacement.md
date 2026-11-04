# Local Governance document replacement: design only

Exact base and source hashes are in `governance-document-replacement.sources.json`; the wire DTO is in `governance-document-head-replacement.contract.json`. No implementation, tests, database or provider operations were performed. This unit addresses an unfinished part of the originally approved local versioned-document workflow: upload already supports exact expectedVersion CAS; native currently always sends null. No schema or new durable namespace is needed.

## Boundary

Keep broad-identity workspace unmounted, Settings read-only identity boundary unchanged, and default-OFF behavior. The actual current read dispatcher returns503 for every old and new operation while the existing Governance feature is disabled/unset, before auth or service composition. Preserve that unconditional gate like upload; introduce no OFF permitlist. No actual flags/environment changes. Preserve current paired reader scope/capability/membership checks, API-key denial, writer collector/policy:manage checks, independent approval and separate execution. No activation/enrollment/provider authority is added.

## Exact read semantics

Extend the existing read dispatcher/service with strict read_document_head plus artifactDigest only. In one transaction, validate current reader, read the selected immutable historical DOC artifact using the history store, derive name and selection from that stored artifact, validate the actual head and blob via existing bounded history/hash/parse checks, and recheck current reader before returning metadata. Use historical read rather than the document-artifact path that asserts selected source is current: an older artifact must be able to locate its newer head. No raw text/base64/facts array, storage writes, collection, caller name/scope/org/version/head ID, or synthetic evidence envelope. Missing/corrupt/foreign/non-document/ambiguous state is generic existing409, never absence. Preserve existing HTTP bounds/rate/deadline/private-no-store. updatedAt is stored head update, never refreshed observedAt/expiry.

selectedContentMatchesHead is selectedSourceDigest === sourceDigest and must be checked by client. Label “Selected snapshot content matches current head”. It proves bytes only, not historical freshness, version identity or approval: later same-byte updates can match. Version999 is readable but cannot be replaced because existing upload permits expectedVersion only0..998.

## Native state and recovery

Select a recorded DOC artifact, deliberately load head, validate all echoed identities and digest comparison, preview bounded new bytes, then deliberately replace using loaded exact version and a new request UUID. Target name/scope are fixed by stored artifact/head metadata; a different local filename cannot redirect target. No typed version, implicit latest selection, automatic refresh/resend or source-authority token. Lock target selection and parent refresh/remount while busy or outcome-held; context changes abort/disown results without autoresume. Keep synchronous in-flight guard and one retained UUID/bytes/target/expectedVersion.

Existing original-actor/request-UUID lookup remains unchanged; do not add original-session equality. found:false remains held, not proof of noncommit. found:true validates original historical immutable artifact against retained bytes/name/scope even after head advances; it supplies neither current head nor recovered headVersion. Never substitute latest state. No head read clears pending mutation, refreshes evidence expiry/epoch or transfers old approvals. Current generic upload409 remains conservative uncertain outcome; no new typed no-commit conflict clearance is claimed.

## Planned finite acceptance seams, not executed

Store/HTTP/client/native focused tests should cover initial version0 -> deliberate head read -> exact replacement1, validated historical selection and derived target, missing/corrupt/foreign refusal, authority recheck, read no-writes/no-body, strict fields/unchanged OFF permitlist/auth/limits, client echo and digest-flag rejection, version999, stale CAS one-winner race, current revocation and rollback. Native tests cover locked parent/target, sync duplicates, unknown held original request, context disown, lookup false held and true original historical recovery without resend/invented version.

Existing request-service seam already covers initial artifact -> proposal -> distinct synthetic requester/reviewer enforcement (not an actual human decision) -> different-content replacement -> old source freshness refusal/drift changed while historical approval record remains. Extend/reuse it rather than creating a new approval path. Same-byte content matching does not grant freshness. Provider enrollment, canonical issuer/custody, business-channel mounting and full Governance completion remain outside scope.

## Source-fidelity correction before implementation

The first frozen prose referred to a historical-read OFF permitlist from older context. Direct inspection of readHttp.ts and requestServiceCore.ts establishes an unconditional disabled503 gate for all reads in this dispatcher. The implementation preserves that actual behavior. The DTO wire fields are unchanged. This correction grants no extra capability, changes no flag and does not alter unrelated execution-policy dispatchers. The original design snapshot remains in Git history.
