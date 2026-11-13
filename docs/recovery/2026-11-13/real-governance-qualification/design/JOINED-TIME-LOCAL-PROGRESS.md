# Joined time integration — first local consumer slice

Owner approved local integration and simulated tests (`call_89eb4532167a4e55b4c65c38f8fe44cc`). No native clock adapter/library adoption, real SQL, credentials, resources, deployment, enablement or spending is authorized. This records partial implementation of the complete approved design, not a replacement completion criterion.

## Actual source changes

The new private execution-time primitive validates the whole interval against immutable expiry/not-before bounds, preserves cancellation and copies both input deadlines and observed endpoints. It supplies no default clock or qualification. Native source credential checks and the private STS issuer share the captured private source; the actual runner captures the original function rather than dynamically looking up a replacement port. The STS boundary and exact ECS update/describe transports require explicit private interval inputs, with no process-clock fallback. Writes bind the original action deadline independently of longer-lived credentials; the reader retains its separate gate.

Independent review found that a new clock await outside final authorization could outlive the last permission check. The correction passes a private one-use time check into the original delegation transaction, which awaits it under the existing locks and repeats current people/source/identity/target/issuer checks before commit. Original role/send intent reservations and one-attempt callbacks are not repeated. The transport requires successful check completion and acknowledged authorization, rejecting omission, duplication, unfinished/rejected checks, lost acknowledgement and late retained closure use. No clock I/O is added after final authorization acknowledgement. Validity through later checks/commit/dispatch still depends on the unqualified native time-profile contract; this pattern does not establish that contract.

The returned STS expiration ceiling is an acceptance check, not proof that all unknown credentials share that bound. Existing original source/derived liabilities and unknown-attempt paths remain. No actual provider or human acceptance is inferred from synthetic callbacks/keys or an in-memory transaction.

## Observed validation

- Actual intercepted STS/ECS regressions first reached one synthetic outbound handler despite credential/action interval overlap; corrected code blocks it. Late authority revocation inside the joined time check reproduced a simulated physical mint through the real delegation store, then passed after the locked correction.
- Additional RED cases caught mutable deadline, replaceable clock port and retained late check capability; corrected behavior refuses them.
- 68 focused checks across6files pass, including installed SDK request construction with intercepted native I/O and the real in-memory delegation path. No external calls occur.
- Root strict native TypeScript check passes. One new test initially needed a discriminated-union narrowing correction; no cast/suppression was added.
- Full ordinary suite:18,937passed,0failed,1,142pending,20,079total;0failed suites. The pending count includes opt-in actual database/native/live coverage. Report: `work/joined-time-vitest-current.json`; no actual SQL ran. Earlier18,927pass receipt predates the final authorization correction and is not substituted for this result.
- Independent source follow-up found no remaining important issue in this initial slice; it explicitly leaves native time validity and the remaining consumers unqualified. No external verification or execution by the reviewer.
- Existing Vite native-config warning remains. No production build, desktop/native packaging, cloud trial or deployment was run for this slice.

## Full approved scope still open

Next implement the same private policy through actual signed-workload iat/nbf/exp authentication/one-use consumption, database-backed human/session validity, source admission before acquisition, template/image/post/schedule/manual paths and native closure. Preserve audit ordering and row locks; never replace every transaction timestamp with an interval endpoint. Complete the transitive caller/SDK-signing review, real supplier/release/host/channel/fleet/custody qualification, actual isolated database journeys under specific authority, complete build/review/green PR and genuine independent human/provider end-to-end acceptance. Activation stays unavailable. No full Governance/master completion is claimed.
