# Joined time — credential closure and issuer admission controls

Local source/simulated tests under the existing joined-time approval `call_89eb4532167a4e55b4c65c38f8fe44cc`. This is custodian credential closure, not ServiceNow ticket closure. No real SQL, credential/native-clock/provider action, cloud resource, deployment or enablement occurred.

## Changed execution path

Fresh closure observations require an explicit controlling signal and captured private time source, exact current reader session bounds and the existing original issuer/action locks. Both pre-event and final checks require the private interval to lie strictly after the complete evidence's credentialNotAfter bound and before receipt expiry. After awaited time reads, current source/authority and original snapshot checks remain. A final failure rolls the transaction back. Existing intent/credential histories are neither cleared nor reconciled into a native provider outcome.

A previously saved observation can still be recovered through the original history-only path without claiming a new native check. Refresh needs fresh qualification/time. Neither that cached read nor a digest grants permission to reopen the issuer.

Begin/abort-drain control preparation, review and execution additionally check the current control deadline and all relevant human session lifetimes using the private source. Abort-drain means restoring issuer admission, not rolling back a provider deployment. When an original closure is present, every subsequent current check—including post-write checks—also enforces its liability lower bound and receipt expiry. Existing assertAbortSafe and assertNoCustodianIntents requirements remain; no empty application ledger is treated as complete fleet proof. Controls without a qualified source remain unavailable.

## Independent review correction

Review found that checking sessions separately could let a later clock interval exceed an earlier participant's expiry. Two actual-store regressions reproduced this: a tentative closure committed despite later reader expiry, and a control executed when its later interval contradicted earlier participant checks. The correction captures immutable session windows and intersects ALL relevant bounds on the final interval read. principalTime now returns that private frozen window; its existing operational caller can discard it, but that is not proof of complete cross-participant/transitive composition. Native time/profile/source validity through final checks and commit remains unqualified.

## Observed tests

- The initial five closure-store cases failed behaviorally against the old code: liability overlap/equality, receipt expiry, unavailable refreshed clock and authority revocation during the clock read. Two initial drain cases reproduced deadline and reopening-bound failures. Both later session-intersection regressions also failed before correction.
-36focused checks across five files pass. They include actual in-memory service/kernel paths, rollback after tentative event, original lost-acknowledgement history recovery, cancellation, expired participant and original snapshot/unknown preservation. Authority/native fleet/cutoff/time evidence is synthetic; these are not genuine human/provider/native acceptance.
- Root strict types pass. Full ordinary suite18,961pass/0fail/1,142pending/20,103total;0failed suites. Report: work/joined-closure-reviewed-vitest.json. The earlier broad report predates the final intersection correction and is not substituted for this result.
- Independent source follow-up closes the reported P2 and finds no remaining important issue in this slice; reviewer performed no execution or provider/SQL access.
- Actual PostgreSQL opt-ins remain skipped. Their source fixtures explicitly supply simulated future clock values (matching their already-simulated native lifetime evidence); no real time or SQL qualification follows. No source expiry/assertion/deadline was weakened. Existing Vite configuration warning remains.

## Full continuation still required

Finish time-aware template/image/post/schedule/manual operations and source-acquisition composition, plus the complete cross-participant/transitive caller and SDK-signing audit. Verify the actual runtime binds every consumer to the same qualified protected source/profile; injected callbacks and matching receipts do not prove it. Actual database, native host/channel/ClockBound release, custody, fleet cutoff, unknown credential lifetime, genuine independent human workflows and provider end-to-end acceptance remain required before any exact scope enablement. Production schema/deployment/flags and spending retain their separate approvals. Preserve the existing written ServiceNow unknown attempt without resend. Full Governance/master remains incomplete.
