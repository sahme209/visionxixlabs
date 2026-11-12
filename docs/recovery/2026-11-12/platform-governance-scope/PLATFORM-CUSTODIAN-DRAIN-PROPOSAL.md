# Platform custodian drain and closure — proposed local design

Status: specification prepared, implementation approval requested. No action/flag/schema or native provider change performed.

## Source finding and scope

The existing `enrollmentDrainStore.ts`/`enrollmentDrainAuthorityCore.ts` establish independently reviewed transitions, durable outbound slots and qualified quiescence, but their canonical scope and authority are organization/workspace-bound. The platform `currentAuthority.ts` deliberately does not derive platform privilege from a tenant role. Using a fake organization, the desktop pairing workspace or an org-owner alias for platform drain would violate that boundary.

The new recorded custodian inventory is read-only and covers recorded platform attempts only. It cannot provide the native/fleet drain proof required by the private issuance design. Reuse the existing PLATFORM action/review/claim/event primitives and current paired platform authority for these decisions; do not create a parallel reviewer system or relabel tenant authority. Reuse the existing drain protocol's invariants and exact-history validation where scope-independent, not its org grants.

## Proposed local operations

1. **Begin platform issuer drain.** Exact platform plan binds custodian/issuer profile digest, current barrier revision, current source/runtime/trust revision, requester and distinct genuine reviewer, expiry and original request reference. A separate original-requester execution consumes the exact independently reviewed action once. It creates the next immutable platform drain generation. No native credential revocation, role change or service shutdown is implied.
2. **Abort platform issuer drain.** A separate exact independently reviewed action can restore only the still-current predecessor admission/profile, after fresh qualification. It cannot erase unknown work, restore a revoked profile, revive a prior action approval or reopen an old generation. A changed profile needs its own accepted profile, never a silent abort fallback.
3. **Observe closure.** Read-only, separately qualified observation binds the exact current drain generation, complete issuer/fleet inventory, original source/result credential leases and native outcome references. It supplements history; it never resets an unknown attempt, closes a deployment result or authorizes replay. Current people/source qualification and genuine reviewed control decisions remain separate from an evidence digest.

These are proposed local closed-union platform operations, not permission to call IAM or shut down any actual runtime. The implementation must reuse the dedicated platform ledger and add only the minimal local barrier/slot storage necessary for transactional serialization. Any local schema addition must follow the existing DMMF/pin review procedure; no production migration is included.

## Issuance and in-flight ordering

Use one canonical issuer/profile key, excluding random action IDs. Begin/abort transitions and issuer-slot reservation use that same transaction lock. Every source acquisition, resulting role acquisition and native send must have its original durable attempt and exact submission intent before reaching the corresponding native boundary. Missing/unreadable barrier or unqualified scope refuses; no alternate issuer/workflow/script is exempt.

A drain stops NEW admission to that issuer generation. It does not pretend a committed marker can recall a packet or credential already in flight. Previously admitted native-ready intents remain blocking until their actual known/unknown outcomes and lifetimes are qualified. If a drain arrives between the last local check and native dispatch, the original intent preserves that liability; do not manufacture a clean drain from a clock ordering. No transaction lock alone is claimed to hold across remote I/O.

Existing claim/credential/source observation callbacks remain one-use. Late results record truthful known/unknown facts without new authority. No automatic poll, repeat, compensation, IAM revoke, expiry cleanup, process kill or token export occurs.

## Closure evidence and refusal

Use `CREDENTIAL-CLOSURE-SOURCE-REVIEW.md` and its three approved AWS sources. Prefer actual issuer/fleet drain plus qualified lifetime bounds. Do not implement a fixed wait or treat successful GetCallerIdentity as native write or closure evidence. The qualifying source must establish:

- Every relevant producer/runtime/old version/maintenance path is covered, and no new credential can be acquired outside the drained generation.
- Exact source AND derived execution sessions, with native provenance for known expiration and conservative independently established bounds for unknown issuance. Missing old/legacy inventory remains blocked.
- A trusted current-time interval beyond the applicable lifetime bounds, including clock uncertainty, and no renewal/new session after the drain boundary.
- Exact current source/runtime/trust/profile and resource-path coverage. One role cutoff does not prove every later or derived session safe; policy propagation and resource grants must be considered by actual qualification.
- Native target/effect quiescence separately: credential closure does not prove an uncertain deployment never happened. Original target holds, consumed actions and unknown provider history stay intact.

No production qualifier exists merely because these references validate structurally. Default custody/fleet/time/provider suppliers stay unavailable. Output must distinguish recorded inventory, qualified native closure and current execution permission; none may stand in for another.

## Required implementation/acceptance tests

- Real current paired platform requester/reviewer, no tenant-owner alias or self-review; exact plan/version/profile/expiry and current role/session revocation.
- Concurrent begin versus native intent reservation under the same key; new intents refuse after drain, while earlier pending/unknown slots block readiness.
- Lost begin/abort/slot/observation acknowledgement preserves original reference and history with no repeat or generation reset.
- Abort cannot restore changed/revoked source or bypass blocking unknown slots. Distinct issuer generations cannot adopt each other's records.
- Complete source/result inventory; known and unknown acquisition; derived session coverage; untrusted time, mere local expiry, stale source, caller-identity-only evidence and unavailable provider proof all refuse qualification.
- Positive local journey with actual isolated SQL/platform participants/events, synthetic qualified fleet/time/provider receipts and installed SDK dispatch intercepted. Clearly distinguish this from actual runtime/provider acceptance.
- Actual defaults/legacy caller coverage and complete workflow integration, followed by matching whole-branch checks and the single final independent review. Do not call a new refusal or parser full Governance.

## Requested authority

Approve LOCAL source and minimal local schema preparation plus synthetic/owned isolated database tests for this reviewed platform-scoped drain/closure design. No actual account or provider reads, credentials, native runtime/service/host changes, IAM/revocation, workflow run, production schema/flag/settings, deployment, external post or spending. Those real effects and actual qualification retain separate owner decisions. Existing original unknown attempts and all backups are preserved.
