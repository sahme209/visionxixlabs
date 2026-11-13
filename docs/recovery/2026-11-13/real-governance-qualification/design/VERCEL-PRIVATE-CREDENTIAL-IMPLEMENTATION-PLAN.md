# Private Vercel credential composition implementation plan

Goal: implement the owner-approved local-only design in VERCEL-PRIVATE-CREDENTIAL-COMPOSITION-PROPOSAL.md without real SQL, credentials, network/native actions, activation or spending. Use existing action/child/target records; no schema or dependency change. Work inline, with final independent whole-unit review. Preserve current history and original unknown attempts.

## Task 1 — original acquisition owner

Files: actionStore.ts, deploymentJoinedTime.test.ts.

- [x] RED: actual original child has no acquisition authorization/reservation method. Add cases for one held target before synthetic copy, duplicate acquisition, clone after unknown and lost acquisition-commit acknowledgement without provider receipt.
- [x] Add beforeEffectCredential(proof,effect,principal,nativeCheck): one-use per original child; lock original action/target, validate exact participants/source/time, reserve native target and consume the native callback in that transaction. Acknowledged commit alone grants lexical acquisition permission.
- [x] Extend original timely helper with optional native callback that only tightens native bounds using existing session/action/source intersection; repeat source/people afterwards. Existing decisions still use captured private clock. No new time supplier.
- [x] Preserve a held reservation with no invented provider request receipt if acquisition/final authorization is uncertain before send is granted. Test actual coordinator records original unknown and refuses replay.
- [x] Focused GREEN and strict types; retain a ledgered intermediate state until Tasks2/3 close the old final-send route.

## Task 2 — private transport and final owner

Files: effectExecution.ts, actionStore.ts, new deploymentNativeTransport.ts/private runtime binding, lib/deploy/provider.ts and associated tests.

- [x] RED: environment/options token path reaches mocked fetch without a qualified private native runtime; held credential expiry/cancel/mismatch and pending callback still send.
- [x] Attach exact private runtime with shared captured clock/signal to original opaque execution binding. Coordinator supplies original acquisition and final callbacks; no proof or raw credential export.
- [x] Final owner requires acknowledged acquisition, verifies SAME target hold and consumes native callback at the end of original transaction. Preserve original one-send/commit-ack/outcome/result logic; no nested authorization.
- [x] Fixed native transport only copies already-held credential, requires actual supported bounds/currentness and profile qualification, joins cancellation/timeout, checks complete post-clock callback consumption and exact effect/body/target/result. Remove environment/options credential fallback from actual provider. No real default.
- [x] Update existing tests with explicit synthetic native runtime; preserve unsupported-provider/result-state/source-negative assertions. Add no-replay/clone/pending/timeout/concurrency tests.

## Task 3 — actual request/HTTP composition and final evidence

Files: requestComposition.ts, deploymentExecutionHttp.ts, opt-in sqlRepository.pg.test.ts fixture definitions, demoScenarios.ts and living docs.

- [x] Configure private transport factory only in actual authenticated composition; bind its guarded clock and original request signal. Missing runtime refuses before parent claim. Prepared HTTP obtains its original binding here, not from command JSON.
- [x] Join actual request→preparation→genuine simulated review→claim→child→transport→receipt/result, plus lost bearer/source/role/credential/callback/ack and canceled/clone negatives.
- [x] Adapt affected opt-in SQL definitions explicitly as synthetic evidence, without running SQL or replacing actual default qualifications. Keep real native/source/custody acceptance open.
- [x] Focused tests, strict root types, full ordinary suite, independent source review/corrected RED→GREEN. Update internal demo, exact source/log receipt and all five living docs using backed-up additive preservation.
- [x] Commit explicit paths on branch only. No push/PR/build/deploy/enablement inference; applicable existing final publishing and real qualification gates remain separate.
