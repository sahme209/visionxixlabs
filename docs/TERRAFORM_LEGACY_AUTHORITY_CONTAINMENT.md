# Legacy Terraform authority containment

Source milestone approved 2026-10-18 from main `1cd5bc23`. This closes an older
lead-token execution path; it does not implement customer saved-plan production,
approval, apply, backend/state locking or recovery.

The actual `/dashboard/resilience` flow previously generated a text job, invoked
live init/validate/plan through the Next request, accepted `CONFIRM APPLY`, wrote
`approvedAt`/`approvedBy=leadId` and displayed Ready to deploy. It did not resolve
the completed tenant/request/version-bound saved-plan artifact contract. A signed
lead token is ownership of that legacy job, not current workspace authority.

Current behavior:

- `/api/terraform/plan` preserves token/input/rate/foreign-job isolation, then
  returns HTTP403 `legacy_terraform_authority_unavailable` without invoking the
  runner or changing the job.
- `/api/terraform/approve` preserves token/input/foreign-job isolation and refuses
  approval with the same bounded unavailable result. It never records approval or
  emits `terraform.apply_approved`; refusal audit is best-effort.
- Exported `terraformInit`, `terraformValidate` and `terraformPlan` refuse before
  even CLI detection, database IO or provider initialization. Changing the legacy
  apply flag cannot enable these helpers. No new enabling flag exists.
- Legacy job reads retain historical fields, but explicitly return
  `evidenceKind: legacy_text_only`, `approval: unavailable`, and
  `executionEnabled: false`. Old timestamps/status are history, not authority.
- Resilience still supports analysis and configuration generation. It identifies
  the output as a configuration draft, explains unavailable planning/approval and
  offers no live plan, typed-confirmation or apply control. It does not infer
  deployment readiness from a generation response or historical status.

HCL generation/export, approved tenant downloads, unsigned previews, exact saved
binary capture/encryption, optional storage and paired/native saved-plan reads
are unchanged. The existing independent apply kill switch and signed-handoff
refusal remain intact. No tenant is inferred from a lead; no schema, producer,
approval engine, ledger, signature or deployment capability is added.

## Focused evidence and limits

Baseline: three existing apply/read files / 17 tests passed. Actual-handler,
direct-runner and actual-page regressions then failed RED: 14 expected failures
with five existing input/auth/isolation passes. Approval returned200/wrote state;
planning reached a harmless no-send subprocess sentinel; historical reads lacked
the unavailable projection; the actual page displayed the live planning control.
Sentinels refused before any real subprocess/provider operation. The corrected
two files / 19 tests passed GREEN, including both legacy apply flag values,
all three planning helper exports, audit failure and actual React clicks with
mocked transport. This is source/component evidence, not owned HTTP/PG or native
provider acceptance.

The focused regression set passed 11 files / 93 tests, covering those cases,
existing apply gates, saved-plan artifact/read/paired/native behavior, signed
handoff refusal, approved HCL/unsigned preview boundaries and demo contracts.
This focused count is separate from the full-suite results below and does not establish runtime acceptance.

Independent source review passed the route/runner/page implementation and found
one adjacent P2: the live Assistant system prompt still recommended the removed
confirmation panel. Only Terraform-specific rules 15/16 were aligned. The actual
assistant request-composition regression failed RED for ordinary Terraform and
`CONFIRM APPLY` requests, then passed with unavailable guidance. Two additional
actual assistant cases preserve unrelated plugin confirmation/dry-run behavior.
Model, persistence and plugin boundaries are synthetic no-provider adapters;
prompt delivery does not prove deterministic model compliance. The actual
route/runner refusals remain enforcement. No tool, permission or capability was
added or changed.

With that follow-up, 12 focused files / 97 tests passed. The new prompt regression
has zero lint warnings. Linting the existing Assistant file with max-warnings0
still reports its two pre-existing unused-variable warnings (`e` at237 and
`requiresApproval` at315), zero errors; programmatic before/after lint-text
comparison confirmed identical diagnostics. No unrelated runtime cleanup or
rule suppression was included to hide this baseline limitation.

After independent source review and normal main `10882dc2` integration, clean
`62f21552` passed fresh whole-web types (8192 MiB, incremental disabled), the
default suite (7150 tests / 658 files; eight tests / one optional file skipped),
desktop types/build, Python CLI30, offline evidence16 and tracker18 sources /
2112 rows. The source-validation receipt records commands, exact hashes, logs,
cleanup and the unchanged lint/build advisories:
[`local-terraform-legacy-authority-source-validation.json`](mission/local-terraform-legacy-authority-source-validation.json).
An unpublished intermediate demo merge error was corrected additively before
these gates; exact reviewed Terraform and incoming Airflow demo steps were
independently verified. After source-only main `037eacb6` integration,
`7c14b0a3` passed another fresh whole-web type check and 16 focused files /
132 tests, including incoming desktop editor ownership. Feature/incoming source
hashes and exact demo step preservation were checked; only coordinator-owned
checkpoint documentation changed during that window. No second full suite or
desktop build is attributed to the combined head. Final exact-head CI remains a
separate merge gate. No actual owned application continuation ran for this
containment milestone. Existing
genuine CLI/PG/paired evidence in the saved-plan receipt stays bound to its
original commit. No real Terraform init/plan/apply, provider/network,
production DB/schema, native installer or deployment operation is part of this
source milestone. Customer producer/current backend/target/credential authority,
fenced approval consumption, exact saved-binary apply and recovery remain missing.
