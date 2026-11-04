# Public error-response bypasses — local privacy repairs

The prior internal DTO repair does not cover ad hoc response shapes. Bounded source audit found no explicit AxiomError.toJSON callsite under inspected app/api/lib; it did find raw errors in Airflow catches and policy/enrichment persistence responses. Actual handler tests with synthetic markers reproduced diagnostic reflection. This is not evidence of a production credential/customer-data incident or a complete error-transport/security audit.

## Airflow

Three catches (DAG list GET, runs GET and trigger POST) formerly returned arbitrary Error.message text before a colon. A pure19-code explicit public allowlist now preserves established recovery codes and drops private suffixes; unknown/lookalike inputs get the existing read/trigger fallback. Flat shape, status selection, initial session/current authority, dispatch and audit are unchanged. Simulated accepted trigger followed by audit failure makes exactly one trigger and one audit attempt; sanitized failure does not claim no effect or authorize retry.

Genuine pre-edit RED10privacy failures/25passes; post-fix GREEN52passes across actual mocked handlers and pure formatter cases. Existing task-route/mutation-fence tests passed once during RED only, not claimed as post-fix acceptance. Scoped tsc exit0/config/command recorded for formatter+pure test; route handlers executed with mocked dependencies, not full-graph compiled. Independent internal_error_privacy_review PASS/no important findings. Root verified canonical source/test bytes equal frozen reviewed655ba110. Canonicalbd8dbf76 uses a skip-ci message; no actor source rewrite.

## Policy and rationale persistence

Exactly three Error-arm literal substitutions remove raw diagnostics from workforce policy500detail and triage/remediation rationale500hint. Public messages say outcome could not be confirmed and direct current-record reload, not automatic resubmission or a no-side-effect claim. Non-Error unknown fallback, validation/tightening/auth/persistence/enrichment/audit and known migration_pending503 branches remain unchanged. No migration was executed.

Genuine pre-edit RED3privacy failures/9compatibilitypasses; post-fix GREEN12passes. Authentication, tenant-owned rows, Prisma, enrichment/fetcher and audit are synthetic mocks; no AI/provider/database operation. Scoped tsc rooted at the actual-handler test imports its three routes/transitive source; it is not helper-only and not a whole-repository check. Initially empty types.log lacked standalone exit evidence; author supplied exact prior command, captured compiler0 and actual exec chunka369c4 without rerun. RED/GREEN prior compiler-independent tool outputs captured1/0 respectively, with chunks129ae6/edfb9c. Independent code review found no important findings. Root verified canonical42b5c093 source/test bytes equal frozende5a6222.

## Evidence and limits

Original logs/configs/scripts are archived in airflow/ and workspace/ with hashes in receipt.json. Test snapshots gain.txt suffix without byte normalization. Tests used owned caches/configs, cleared synthetic environment, kernel network denial and dependency-cache write denial. No install, live provider/AI/customer DB/native/Keychain/Security helper or Governance issuer experiment. No passing suites rerun after identical-byte integration. No full production build, native restart, deployment or live acceptance.

Other noninternal/ad hoc error forms, full logging/secret/tenant/model-data coverage, independent assessment and actual Governance/custody/fleet qualification remain open. Preserve all unknown/consumed provider actions and current production freeze. These privacy repairs neither approve actions nor enable execution. All15master parents remain open.
