# SDK operational signing implementation handoff

Local approved unit only, owner call_36a6c98e0c5d46d5b545378bfb0e4506. Source and ordinary intercepted SDK tests; not independently reviewed by its author and not native qualification.

The new `nativeTime/sdkOperationalSigning.ts` binds each actual installed resolved client signer. For an authentic operational source it disables SDK clock-skew correction and obtains a fresh exact-window-validated operational observation for each actual signing call. The installed signer performs the cryptography with explicit `signingDate`; nanosecond authorization precedes the documented conversion to the SDK Date representation. Original profile/revision/host/source generation remain fixed. The handler rechecks the exact emitted signing date alongside existing sealed request guards. The strict branch retains the actual original signer and skew configuration; no fake interval is constructed.

Private STS, ECS update/describe and template STS/S3 clients invoke this binder before sending. Their existing exact request, private keys, metadata registries, original admission/owner proofs, final dispatch and no-retry paths remain. The independent S3 `getSignedUrl` path separately obtains fresh explicit signingDate and checks its actual URL date, under the same captured original action/credential window. Existing grant TTL/readback/held-key expiry checks and original before/after authority checkpoints remain; no renewed approval, credential or provider effect is introduced.

Evidence in this folder:

- `RED.log`: genuine actual-installed default-signing baseline, with the initial unbound helper scaffold: five behavior tests fail, one strict-compatibility test passes.
- `GREEN.log`: initial helper implementation, six tests pass.
- `INTEGRATION.log`: initial helper and existing private STS/ECS/template suites, sixty tests pass in four files.
- `OPERATIONAL-TRANSPORT.log`: three additional actual production factory paths pass with the real installed SDK/presigner, authentic operational observations, synthetic credentials and intercepted HTTP.
- `FINAL-FOCUSED.log`: final eight helper cases plus three actual production transport paths, eleven pass in two files. Covers expiry equality, withdrawal and cancellation before signing, exact operational dates, independent presigning, date substitution refusal and strict signer/skew preservation.
- `RECEIPT.json`: exact six owned source/test input hashes and all retained log hashes. Existing Vite/SDK body-codec warnings remain unsuppressed.

No socket/provider/cloud call, real credential, native compile/run/addon, clock/service change, actual SQL, dependency acquisition, CI, deployment or spending occurred. Node SDK execution here is ordinary synthetic/intercepted test execution, not the target Node/AL2023 qualification. Whole-unit type validation and independent review remain with root.

Preparation mistakes are retained separately, not counted as behavioral RED: initial missing-module test invocations ran in the original checkout because workdir was omitted; only the newly authored helper/test and two logs were moved into recovery, then those exact new files were removed from the old checkout. Original checkout scoped Git status is clean for both new source/test paths, the three transport paths and SDK evidence path. No existing original-checkout file was modified. The precise moved source paths were `lib/governance/platform/nativeTime/sdkOperationalSigning.ts` and `lib/governance/platform/nativeTime/__tests__/sdkOperationalSigning.test.ts`; the logs are `WRONG-CHECKOUT-MODULE-RED.log` and `WRONG-CHECKOUT-MODULE-FAIL.log` here. An incorrect test-fixture import and an intercepted STS response missing its request-id header were also corrected in tests only; their failed logs remain distinct from passing evidence.

Ownership handed back: helper, two new focused test files and signing-only edits to `operations/privateStsIssuer.ts`, `operations/ecsSdkTransport.ts`, `templateNativeTransport.ts`. Provider-expiry registries/returned-lifetime changes in private STS are preserved. This author must not perform the independent final review of these changes.

## Strict SDK compatibility correction

Root's whole-suite failure exposed seven failures in unchanged `lib/cloud/aws/__tests__/platformTemplateHosting.test.ts`. Inspection confirmed that its legacy strict SDK doubles intentionally expose no resolved config/signer; the helper read `client.config.signer.bind(...)` unconditionally before checking assurance. This was an unwanted strict-path dependency, not missing operational authentication.

`STRICT-COMPAT-RED.log` reproduces seven failures/seven passes before the fix. The finite helper correction captures and validates the real resolved signer only inside the operational branch. Strict mode reads/changes no SDK signer configuration, preserving its original behavior; operational mode still explicitly refuses a missing actual resolved signer. No legacy mock, assertion, transport or unrelated suite was edited. One focused actual-client test deletes its signer and verifies operational binding refuses.

`STRICT-COMPAT-FINAL.log`: all twenty-six cases pass in the unchanged affected hosting suite plus both actual operational SDK focused files. Prior intermediate twenty-five-case success is preserved separately. Exact new helper/test and log hashes are in `STRICT-COMPAT-CORRECTION.json`; the original `RECEIPT.json` and SDK logs remain historical evidence rather than being silently repinned. No whole-suite rerun, type compiler, native/SQL/network/provider/CI/dependency operation occurred. Independent correction review remains with root.
