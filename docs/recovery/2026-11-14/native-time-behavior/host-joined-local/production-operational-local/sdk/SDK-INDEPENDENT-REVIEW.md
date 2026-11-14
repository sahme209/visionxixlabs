# Independent SDK operational signing review

Verdict: **CLEAR for the local SDK signing slice.** No concrete critical or important defect found. This is source review and retained intercepted-test evidence verification, not target/native/provider qualification or whole-unit acceptance.

Reviewed the helper, both focused test files, and signing-only changes to private STS, ECS and template transports. All six input hashes matched RECEIPT.json at initial completed source inspection. During final artifact preparation the helper changed only its nanosecond divisor from `1000000n` to `BigInt(1000000)`; the current helper SHA256 is `7db8318fff5df2afcd33cf31b15ba3b813785bd286a48e18bfa6bd19627ebdef`. This equivalent conversion was separately read and reviewed. The other five full-file hashes still match. Saved tests remain scoped to the receipt's original helper hash, not silently renewed for the changed syntax. Private STS provider-expiry registry/lifetime work belongs to a separate unfinished lane and is excluded from this verdict.

All four cached installed signer/presigner audit hashes and all nine log hashes match. Retained logs report 11 focused cases / 2 files and 60 integration cases / 4 files. No test was rerun.

## Checked behavior

- Installed core 3.981.0 resolves config.signer and ordinarily injects new Date / systemClockOffset. The binder wraps that actual signer, overrides signingDate after spreading original region/service options, and disables success/error skew sampling only for operational mode. The emitted x-amz-date must equal the explicit date; handlers repeat this alongside original sealed-request checks.
- Independent S3 presigner 3.1166.0 constructs its own signer. The template path separately supplies explicit signingDate and validates X-Amz-Date. Millisecond/second conversion follows exact nanosecond authorization and never replaces expiry predicates.
- Smithy 5.7.5 signing-key cache is keyed by short date, region, service, credential-derived hash and session token. It cannot reuse another day's or credential's signing key. Presigning does not independently shorten TTL to credential expiration: the existing template hardExpiresAt <= held credential expiry check remains necessary and present.
- Clients receive captured explicit credential primitives. Installed normalization chooses these inputs; refreshing a constant object does not activate ambient credentials or provider renewal. Existing source/held-key expiry/currentness gates remain authoritative, including final dispatch after signing.
- Operational signing re-observes its captured source and rejects strict output or changed profile/revision/host/source generation. Intended strict and operational Linux constructors create separate fixed source implementations; operational source cannot return strict intervals, and strict native source does not mint operational observations. Strict signer/skew behavior remains unchanged.
- Original owner callbacks, consume-before-await checkpoints, credential/action bounds, cancellation and final native facts remain. No added endpoint, network path, retry, waiter, origin fallback, dependency or authorization grant was found in these signing changes. Signed dates do not establish provider receipt-before-expiry or closure.

## Minor observations

Optional future hardening only: strict binding leaves the signer unchanged, and strict assertSignedRequest only checks cancellation. A hypothetical future dynamically switching union source could switch to operational observations after initial strict binding while retaining implicit signer time. No such source is reachable in the intended fixed-source composition. Dynamic-source support would need assurance/context freezing or switching refusal; this is not an important finding or a required expansion of this unit. Final new native-wrapper/composition review must confirm the intended same-branch capture actually remains true.

SDK JsonCodec2 and Vite warnings remain unsuppressed. The 60-case receipt precedes the final added focused cases and is not relabelled as final whole-unit acceptance.

## Limits

Only review artifacts were written. No code edit, tests/compiler/native/SQL/network/CI/dependencies/provider operations/commits. No real credentials, clock/service effects, deployment, enablement or spending. Node TLS/external identity clock relation, complete custody/fleet/closure composition, ABI/runtime, all-family coverage and activation remain open. This review adds no physical UTC guarantee and does not close Governance.


## Strict compatibility correction appendix — CLEAR

The actual helper now captures and validates client.config.signer only inside the operational branch; strict observations leave signer/config unread and unchanged. Operational mode still refuses a missing signer, retains the same actual provider binding, explicit fresh signingDate, disabled skew sampling and emitted date validation. This finite lazy-capture change preserves the intended strict behavior while avoiding an unconditional resolved-signer assumption in existing strict test doubles. No critical/important finding.

Inspected STRICT-COMPAT-CORRECTION.json and actual final log (26 passed / 3 files), the new missing-operational-signer refusal test, and exact current source/test + three saved log hashes. All match the correction receipt. Prior SDK receipt/test hashes remain historical, not repinned. This reviewer ran no tests/compiler/native/network/SQL operations.

- `lib/governance/platform/nativeTime/sdkOperationalSigning.ts`: `189b49a2ea07ee5f29377fe215f967add25af5b11ebf75c40a765f197900317c`
- `lib/governance/platform/nativeTime/__tests__/sdkOperationalSigning.test.ts`: `61d2c824efc8b4d30dc596373e13ba2fe68b3340a769b5e4860c225fb29b3082`
- `STRICT-COMPAT-RED.log`: `3a13f154725af5048a3b88e89413ae2c51fbeb9573b42d9ce06f6c749a5377a8`
- `STRICT-COMPAT-GREEN.log`: `9a3710cf6b4c87a99b9dddfc89af901126c8f80320e6c8d998f0eec68c191b33`
- `STRICT-COMPAT-FINAL.log`: `440241ec1e9144dad1218a53f2c644639360b8ae8569e70f21f8d8bf640c557b`
