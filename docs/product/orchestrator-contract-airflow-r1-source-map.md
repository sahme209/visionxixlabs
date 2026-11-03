# Orchestrator contract r1: current Airflow mapping and review decisions

**Internal design supplement, unpublished/unimplemented.** Source scope `107bacd6`; November 3, 2026. Extends, does not replace, [the existing `axiom.orchestrator/1` proposal](orchestrator-contract-design.md). Its envelope, operations, state/error vocabulary, C01–C14 vectors and offline system requirements remain authoritative design proposals. No adapter, Temporal/custom compatibility, offline support, execution coverage or live acceptance is claimed. Documentation only.

## Concrete current behavior to preserve

| Proposed core seam | Actual Airflow source and adapter obligation |
|---|---|
| Connection / credential | `connection.ts:12–51` captures tenant/provider/active connection revision, base URL and encrypted credential; rechecks after asynchronous host validation and before decryption. Preserve scope-bound decryption and current-connection checks. `airflowClient.ts:48–64` currently allows public HTTPS only and blocks private DNS/IPs; on-prem internal-host support is an unresolved reviewed trust-policy change, not an adapter toggle. |
| Authentication / final mutation check | `airflowClient.ts:74–109` supports token or username/password exchange, denies redirects, disables cache, combines bounded abort signals, and calls mutation authority before and after credential acquisition. Keep these checks even when engine authentication itself performs POST. The proposed `start` permit cannot be reconstructed from serialized connection metadata. |
| Read target / poll | `airflowClient.ts:112–159` provides version/DAG reads, bounded latest-run listing, exact run GET and paginated task observations. Bind run/task replies to requested DAG/run; preserve map index/try number/native state rather than flattening tasks into success. No current streaming event subscription is shown by this client. |
| Submit | `airflowClient.ts:162–179` submits `logical_date:null`, conf and a run ID; validates returned DAG/run. A supplied scheduled identity alone permits 409→exact GET readback. A manual timestamp ID has no such conflict recovery. Do not upgrade either to an unconditional deduplication/exactly-once guarantee. |
| Scheduled identity / concurrent edits | `scheduledRunId.ts:4–8` hashes tenant/rule/DAG/occurrence. `automationTick.ts:36–66` uses the captured current rule binding and preserves an accepted receipt when advancing the schedule loses a concurrent-edit race. Migration must retain these identities/history, not reissue occurrences under fresh adapter IDs. |
| Downstream effects / recovery | `automationExecutor.ts:20–103,111–184` is a separate automation action path (none, PR, deployment), with claimed attempt and dispatch intent. Once provider action starts or reservation release is uncertain, it records reconciliation rather than automatic resend. Pre-effect retry eligibility is narrower and must not become generic engine retry authority. `restartReviewIO.ts:14–54` requires exact current restart evidence and locks authority through durable intent. These effects stay outside an engine adapter’s permission ownership. |

## Proposed capability projection — review before implementation

Use the existing strict envelope and a registry-owned profile `airflow-v2-api/r1`. Capability responses must distinguish **implemented in adapter**, **unsupported** and **unqualified**; a provider feature existing elsewhere is insufficient.

- `start`: proposed implementation wraps the existing exact-ID submit. Report manual versus scheduled conflict/readback semantics separately; only scheduled supplied identity currently has observed source support for conflict recovery.
- `status` and `taskPages`: proposed implementation preserves bounded polling and exact identity validation. `events` can initially advertise polling observations only, with no durable streaming cursor or completeness guarantee.
- `cancel`: **unsupported by current client**. No PATCH/cancel method exists here; do not map cancel to marking a DAG failed, clearing tasks or pretending work stopped. A future implementation needs its own reviewed semantics and independent action boundary.
- `retryAssessment`: expose existing distinctions: read retry, eligible pre-effect automation retry, consumed/possibly-written reconciliation. Do not expose `retry()` as a second submit. Normalization of current generic transport exceptions into core `unknown` must be completed and tested before adapter admission.
- `rollback`: no engine-owned authority. Existing restart workflow’s restoration description is explicitly unverified (`automationExecutor.ts:159`); retain that caveat. A compensation workflow cannot authorize a new effect.

Temporal and custom profiles remain **unimplemented/unqualified**. No guessed Temporal workflow-ID reuse, cancellation, history retention or retry guarantee belongs in the Airflow profile. Version-pinned official API research and actual engine conformance follow a separately approved implementation plan.

## Finite next review / acceptance decisions

1. Adopt the existing core envelope and capability distinctions, then select the first real adapter profile. Preserve current Airflow methods while moving IO behind the boundary; do not rewrite authority/ledger as part of migration.
2. Decide exact transport-failure classification and durable submission identity for manual starts. Missing acknowledgment stays consumed unknown; a deterministic ID without authoritative matching readback cannot establish absence or permission to resend.
3. Specify cancel and event support per engine, or explicitly ship unsupported. Decide tenant-scoped credential ownership and internal-host trust policy before customer-controlled installation.
4. Run existing C01–C14 unchanged against real Airflow and Temporal adapters, and publish a documented custom conformance fixture. Include actual scheduled 409 recovery, wrong-run refusal, native state/task pagination, concurrent rule edit, late revocation and uncertain downstream effects. Synthetic contract checks do not replace these engine results.
5. Finish master A9’s actual internet-disconnected governed deployment, security/audit/rollback/recovery, local authorities and reproducible installation/upgrade/backup exercise. This supplement does not narrow those requirements or authorize a provider run.

## Inspected runtime hashes

| Source | SHA-256 |
|---|---|
| `lib/integrations/airflow/airflowClient.ts` | `bbb996a1f06950359d7377a00263f480ec3de57bbc9b4d3de41674a81ea2494e` |
| `lib/integrations/airflow/connection.ts` | `2d25a4c1672d7656bb1e6193c2161028fa923ed637302e1781e902785963b73e` |
| `lib/integrations/airflow/scheduledRunId.ts` | `2e1f250429e05de5ee1ebe7427c4aa781de28defacfbd2daa86b1689cf6c0954` |
| `lib/integrations/airflow/automationTick.ts` | `de89a9cf9809500309ebc63cf3f9c38d8a5c41db50b073f760d9b5fe1f9b06ff` |
| `lib/integrations/airflow/automationExecutor.ts` | `dc99fd78bfd826bf4dae9865d7c8542db6551dff582cae69683c9271137fa582` |
| `lib/integrations/airflow/restartReviewIO.ts` | `5c9b2bc413e801f64a46df51fe62a55e9b290af8dc01f00311ad484471515fcc` |
