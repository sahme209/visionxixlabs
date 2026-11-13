# Proposed bounded live preflight — awaiting fresh owner approval

**Later disposition:** the owner approved this exact sequence. It stopped after the first metadata call because the existing selector could not verify the response; no detail, Neon or SQL call occurred. See LIVE-AUTHORIZATION-2026-11-13.json and LIVE-OBSERVED-RESULT.json. The permission is consumed, not pending or reusable. The proposal below preserves the reviewed scope and does not authorize another attempt.

The new query is `1-PRECHECK-READ-ONLY.sql`, SHA256 `23a6718683fba5baff445e24ab1f648ca8c03e56d478594e2fe37a6d83dc1098`. Its schema/inventory checks and independent source review are recorded separately. It has not been executed. Historical provider/credential allowances are consumed.

## Exact proposed scope: at most five calls, no retries

1. Vercel `filter_project_envs` for the already-recorded project/team, decrypt=false. Privately identify exactly one unbranched production DATABASE_URL record. No raw response, names, IDs or values in messages/workspace files. If the result cannot be interpreted unambiguously, stop without guessing a schema or making the decrypted call. The earlier comparison stopped at this stage; its cause remains unconfirmed.
2. Vercel `get_project_env` for that exact selected record only. Privately compare its unchanged ID/update metadata, target, exact endpoint/port/database and allowed connection-string shape with the recorded Neon target using the existing reviewed comparison helper. A mismatch/unknown stops. Do not output or persist the URL/password/username/query values, enumerate other secrets, or chase a different target. A current project production setting is not by itself evidence of the configuration captured by an older running deployment.
3. Neon `get_postgres_endpoint` for the exact recorded compute in the explicit recorded project. Verify its endpoint/branch association against the privately compared setting. No start/restart, endpoint creation or alternate-region scan.
4. Neon `get_branch` for that exact explicit project/branch. Verify the recorded production branch identity/protection; a mismatch or ambiguity stops. This is not full backup/recovery qualification.
5. Only after all target checks pass, Neon `run_sql` once with the exact file bytes/hash above, explicit project/branch/compute/database and max_rows=1. No fallback/default branch or second SQL statement. Save only the source-bound metadata result or fixed failure category, never credentials/raw provider errors. If observation is delayed, preserve the live tool handle and wait for the same invocation; timeout does not authorize restarting it.

Private platform/tool traces may retain raw Vercel responses, including the decrypted detail response; the owner must consent to that before the run. Do not use response logging or raw text output for diagnosis. Metadata shape inspection remains private and grants no broader secret read. This proposal approves nothing until the owner answers.

## Stop conditions and limits

An unsupported response wrapper, duplicate/custom/branched production variable, changed metadata, unrecognized URL/profile, mismatched endpoint/project/branch, provider denial/error, truncation or failed SQL stops the sequence. Preserve the attempt and report unverified state. No automatic retry, new credential/grant, account setting, schema/migration/ledger write, backup/branch creation/deletion, provider effect, deploy or spending. A successful result is schema-screen evidence only; it is not approval to repair, release or enable Governance. Pool/TLS/native/recovery and original human gates remain.

Independent source review found no important unsafe authority/sequence mismatch in this proposal. The reviewer did not validate live tool responses, current target, credentials or SQL execution. Available connector signatures were inspected locally without calling the providers. This review grants no execution authority.
