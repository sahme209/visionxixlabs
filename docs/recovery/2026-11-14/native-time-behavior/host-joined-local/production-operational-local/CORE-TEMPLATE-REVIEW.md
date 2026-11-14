# Independent core/template slice review

Verdict: **WITH FIXES — two important source findings; no critical finding identified.** This is a completed-slice review, not a whole-unit currentness verdict. Exact reviewed file hashes and scope exclusions are recorded in `CORE-TEMPLATE-REVIEW.json`.

Reviewed actual changes against baseline `876da65ffe727c584b6f682d72a22b66feed9199`, including the explicitly new operational source/tests, the canonical design and owner authorization call_36a6c98e0c5d46d5b545378bfb0e4506. No tests were run and no implementation file was changed. Native composition, closure and provider-expiry registries still under construction were not treated as a completed deliverable.

## Strengths

The operational common window uses exact nanosecond comparisons, admits not-before equality and refuses expiry equality without creating a zero-width strict interval. Registry identity rejects copied observation fields and consumes a token once. The returned-credential helper removes the direct strict-only scalar use in STS while keeping the requested-duration policy separate from closure. Template preparation now captures timing and profile windows, includes the prospective reviewer before private bytes/approval and keeps existing-reference recovery clock-free. Request wrappers preserve possession checks and the captured source rather than minting a new observation.

## Important findings

### 1. Final template timing checks precede later profile awaits that can invalidate the decision

`lib/governance/platform/templatePreparationStore.ts:25–28` samples joined participant/action/profile time, checks actor authority, then awaits `profiles.read`, `profiles.assertQualified`, another `readTimeWindow` and `tx.now()` before returning. It never samples the selected clock or checks the actors again after those profile awaits. The final `timely` calls in prepare/preview/review (`37,39–40`) therefore do not repair the ordering.

Concrete trigger: on the final profile read/qualification, advance the selected clock to the original action/session/profile expiry, while DB time and the profile-window coordinates remain unchanged. The earlier time comparison passes, the later DB-only comparison passes, and preview can return private bytes or prepare/review can complete. Similarly, revoke a participant during that final profile await after the last actor check; the helper can still return. The existing source-read-crosses-deadline test changes time during the earlier template-byte read and does not cover this last-await seam.

Finite fix: complete profile/source qualification before the decisive joined-time check; preserve current actor and exact binding/profile-window checks around the relevant awaited work and at the original phase's final owner boundary. Add regressions targeting the LAST profile read/qualification after earlier positive checks, covering expiry and participant revocation, with the original transaction rolling back approval/insert/event when refused. No new transaction or deadline extension is needed.

### 2. Known source retirement leaves previously issued operational observations eligible for first use

`lib/governance/platform/nativeTime/operationalSource.ts:35–39,58–59` stores only the observation in the global WeakMap. The source's retirement latch is local to its source closure; retirement does not invalidate that source's already registered observations. `executionTime.ts:29` accepts an eligible registered token without consulting its originating lifecycle.

Concrete sequence: obtain an authentic unconsumed `value = await clock(signal)`; withdraw the source and invoke it again so it rejects and calls `retire`; then invoke `assertExecutionWindow(async () => value, window, signal)`. The old token remains registered and unconsumed, so the common predicate accepts it despite known retirement. One-use consumption prevents a second use, but does not prevent this first use after withdrawal. This is a completed registry/lifecycle behavior, independent of the remaining native implementation.

Finite fix: associate each registered observation with its originating live lifecycle/context and refuse authority reads/consumption after that lifecycle retires. Preserve metadata use by the returned-credential helper for the accepted active observation without making metadata parsing a new authority path. Add a regression for an issued-but-unused token followed by known withdrawal/retirement and attempted first consumption; it must refuse. No numerical age bound or fabricated native qualification is required.

## Critical findings

None identified in this slice.

## Minor / deferred

No additional minor change requested. The template test fixture uses a strict injected interval; it does not establish operational native/template composition acceptance. The separate operational-source tests and future whole-unit composition evidence must retain their actual scopes.

## Declined to judge

- Actual C initializer/native producer/owner/status bridge composition and physical currentness: remaining unit work, not finalized by this slice.
- `privateStsIssuer.ts` provider-expiry registries and provenance additions: explicitly outside this review; only the common returned-lifetime helper call and removal of direct `.earliest` use were reviewed.
- Custodian closure/drain implementation, complete selected-library integration and all-family coverage: reserved for the coherent frozen final diff.
- Native compilation/execution, SQL, real custody/fleet/provider/human acceptance, production registration and activation: not performed or inferred.

Both important findings were sent directly to the TS implementer and root. A later correction/review must bind new exact hashes; this report does not imply the concurrent whole unit is frozen or complete.

## Focused correction follow-up

**Correction verdict: CLEAR for the two original findings; both are closed at the appended exact hashes.** The original findings and original input hashes above remain historical evidence. This follow-up inspects only the correction and its regressions, not the remaining unit.

- Finding 1: `templatePreparationStore.ts:25–29` now performs profile read/qualification and expected digest validation before the decisive participant/time check. Actor authority follows that check, with profile-window equality, cancellation and DB-order checks retained. The shared helper is still invoked at the original prepare/preview/review boundaries. The new two-case test targets the measured final profile read during preview, independently injecting expiry and role revocation; both require refusal instead of returning private source content.
- Finding 2: `operationalSource.ts:28,35–39,58–59` now associates registry entries with their originating lifecycle and checks that lifecycle before returning authority metadata or consuming the token. Once the source's catch path sets retirement, previously issued unused tokens are ineligible. The new regression mints the token, causes actual source-wrapper retirement through withdrawn mocked native input, and verifies first consumption refuses. The correction also rejects changed disruption markers and context mismatches; neither is treated as actual native qualification.

Inspected the supplied saved logs without rerunning them: RED records the three exact reported regressions failing, with ten other tests passing; GREEN records thirteen tests passing across the same two files. The existing Vite configuration warning remains in both logs. These are implementer-executed ordinary mocked/source results, not reviewer execution or native evidence. Exact four corrected source/test hashes and both log hashes are appended in the JSON companion.

No remaining important issue identified in the correction to these two findings. Whole-unit native composition, provenance/closure, library/caller integration and activation remain outside this follow-up and still require their coherent frozen review.
