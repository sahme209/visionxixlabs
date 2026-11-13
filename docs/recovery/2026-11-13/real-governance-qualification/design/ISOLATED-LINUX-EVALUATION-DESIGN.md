# Isolated Linux qualification — complete design candidate

Owner decision call_dfa1d5243aba4d3a936d08345d62cfab accepts ClockBound3.0.0-rc.0 ONLY as a candidate for an isolated Linux evaluation DESIGN. It authorizes no adoption, installation, clock change, account/API access, credential, IAM/resource creation, native experiment, spending or activation. Current merged source remains PR329/0a240c6, seven PR and six main checks green. All full-master and Mac/other-family requirements remain.

## 1. Explicit topology and trust

Proposed profile: one dedicated ECS-on-EC2 executor host, a separate role-free Fargate PostgreSQL fixture task, and a separate role-free Fargate disposable target service. This preserves the current ECS task-credential supplier contract; it is NOT a direct-EC2 credential-source substitution. The m6i.large/20GB gp3 Ohio price candidate is not a qualified or selected instance/OS/image. Actual availability, architecture, PHC/VMClock support, disk minimum and capacity require verification before resource approval.

The host runs only the fixed closed private executor plus its initializer and the separately controlled time daemon. No AI/model/general agent code, public shell, ECS Exec, image/command/environment overrides or ambient credential chain. Privileged installation/daemon/maintenance administrators are explicit trusted actors; this design does not pretend to defend against a malicious host root or AWS administrator. Native metadata is task identity evidence, not whole-process attestation.

The time daemon and its writable backing files stay in the trusted administrative zone. The restricted executor receives only the fixed qualified reader channel and private resource bootstrap; no authority to alter the time source, mappings, daemon settings or source image. The external observer has separate identity and cannot be a client/model-supplied JSON document. Fixture DB and target must not share the executor task role or its host credential endpoint; effective network/metadata isolation must be natively proved rather than inferred from task names. No existing database/backups are reused or deleted.

## 2. Roles, capabilities and resource boundaries

| Component | Needed capability | Prohibited or independently held |
| --- | --- | --- |
| Trusted provisioner/maintenance | Exact reviewed initial host, daemon, immutable image/configuration and owned retention/cleanup | No ordinary requester/reviewer/provider decision; no broad runtime admin or unattended reconfiguration |
| External runtime/fleet observer | Exact current host/task/image/profile/generation and lifetime observations, with authenticated provenance | Cannot mint approvals, fabricate clock bounds or convert task stop into credential closure |
| Closed executor task | Private DB/session/vault resource access and exact approved source-role acquisition/provider actions | No bootstrap role changes, mutable source, arbitrary native requests, credential export or automatic renewal/replay |
| Requester and separate reviewer | Actual sign-in, inspect exact source/target/evidence, independent decision and requester execution | No agent impersonation, prefilled fake approval, shared identity or fixture-token acceptance |
| Fixture database task | Fresh isolated synthetic database; setup admin distinct from restricted runtime role | No production Neon, application task role, public DB ingress or provider credentials |
| Disposable target task | One measured healthy baseline and expressly approved replacement | No application task role, unrelated workload/resource access, automatic rollback or unbounded replacement |

Every proposed IAM statement, security-group/route rule, credential delivery path and cleanup target must be rendered as an exact before/after diff in the eventual frozen resource packet. No permission change is authorized by this table. No NAT gateway, load balancer, managed DB, extra observer host, registry, endpoint or log service is silently added; any required component must be explicitly priced and reviewed.

## 3. Time source and original execution contract

Candidate source is fixed at371058f8f6a1786d4a4ab3eed9f5f2f16eea7777/tree6261c1659ff53ccec76cea26a3051fa680d9f676. Eight approved reads identified version/license/client API but did NOT audit underlying snapshot/growth/mapping implementations. Existing public-read authority is exhausted. Source audit inventory is attached below; no automatic follow-up fetch.

The future native bridge must retain exact protected host/runtime/path/profile identity, actual reader status, interval origin and validity through the original final authorization and physical dispatch. Do not cache a prior successful time response, use a Date/DB fallback, assume fixed drift or treat successful library return as synchronized status. Unsupported/stale/disrupted/mismatched state must refuse. Any FreeRunning acceptance needs separately established growth/validity evidence, not a guess.

The original action/source/JWT/human/credential windows and original custodian intent remain authoritative. Validate one intersection inside the original locked transaction and consume final native facts after its last awaited checks; no new attempt or independent post-commit clock can repair an invalid original authorization. A library timestamp alone does not establish the latency/valid-through-dispatch guarantee required by the qualified transport.

Conversion must widen rather than narrow native intervals: preserve integer precision, reject malformed/negative/reversed/out-of-range timestamps, floor the lower endpoint and ceil the upper endpoint when converting to integer milliseconds. Expiry remains strict. UTC/leap/smear and workload/credential timestamp compatibility, daemon restart/suspend/disruption, backing-file replacement and unsupported architecture all require real evidence. These are design requirements, not an implemented/approved bridge.

## 4. Finite evidence and execution sequence

| Gate | Required evidence before next gate | Failure disposition |
| --- | --- | --- |
| L0 Candidate/source | Exact client and delegated snapshot/mapping/time source audit, licenses, supported OS/architecture and dependency/binary provenance; review prerelease limitation | Remain unavailable; no installs/probes to paper over missing contract |
| L1 Frozen local composition | Actual private initializer/executor/reader/observer/identity path and existing stores/handlers; ordinary/intercepted tests; independent review; exact artifacts | No native qualifier/default/production registration merely to make tests run |
| L2 Resource/budget decision | Account/region/owned resources, full quote and retention, exact IAM/network diffs, source image/OS/program pins, prechecks/stop/cleanup packet | No provisioning until explicit scope/spend approval; uncertainty is not a zero cost |
| L3 Role-free native security | Actual runtime identity and immutability; protected time source/status/growth/disruption; denied alternate caller; bootstrap/process/fleet isolation; bounded cancellation | Stop one invocation; preserve failed/unknown history; no credential/provider effect |
| L4 Credential custody/currentness | Actual qualified supplier and inventory, native renewal cutoff, unknown-source/derived lifetime handling, current original authority through acquisition/dispatch | No role/credential test before exact approval; stopping compute is not closure |
| L5 Genuine human workflow | Separate real requester/reviewer sign-in, exact evidence preview/decision and requester execution using real accepted app/client/HTTP path | No seeded approvals or agent action for a human; do not reuse expired decisions |
| L6 One disposable provider trial | One exact authorized deployment against a measured healthy target; actual request/result and native terminal readback, revocation/concurrency/lost-result evidence | Unknown never replayed; no second deployment/rollback/replacement without new exact authority |
| L7 Closure/acceptance | Actual source cutoff, complete relevant credential/effect lifetime/closure, retained audit/history, exact owned cleanup and cost/retention evidence | Keep outstanding liabilities/unknowns; no erased history or speculative deletion |

This is the complete selected-platform trial, not full Governance. Other covered provider/action families, Mac/Windows/installation, independent security, production compatibility and every master requirement need their own evidence. Only separately approved, fully proven scopes may eventually activate; no partial-enablement claim follows here.

## 5. Complete cost model — quotation still gated

Reuse observed Ohio public rates only: m6i.large0.096USD/hour; Fargate0.04048USD/vCPU-hour and0.004445USD/GiB-hour; publicIPv40.005USD/address-hour; baseline gp30.08USD/GB-month. These are dated source observations, not an account quote, selected resource, capacity or current spending authority. Original source/calculations remain in EC2-BOUNDED-FOLLOWUP-RESULT.md and FULL-TRIAL-COST-SUPPLEMENT.md. No new price request occurred.

Define EACH billed lifetime separately: executor host H; fixture D; baseline target T; replacement overlap R; build/bootstrap/observer and retained component hours; each public-address lifetime I[j]; and disk lifetime S (including after compute stop). Compute subtotal is0.096*H +0.04048*(0.25*D+0.25*T+replacement_vCPU*R) +0.004445*(0.5*D+0.5*T+replacement_GiB*R) +0.005*sum(I[j]) +0.08*diskGB*S/720, with the720-hour month assumption stated. It is NOT the final total.

The actual quote must explicitly price or prove absent: OS/image/root disk minimum, build/bootstrap/observer duration, target baseline/replacement overlap, image upload/pull/retention and registry requests, logs/metrics/API requests, transfer/egress, any endpoints or extra services, evidence/backup/disk/IP retention, failure/cleanup delay, taxes and contingency. Separate each component's finite time/resource maximum and independently enforced stop from an alert; AWS budgets/alarms are not hard caps. The old6.90cent simultaneous30-minute subtotal excludes these items and must never become the full spend request.

Before asking to create resources, provide ONE full line-item numeric quote, enforceable operational limits, exact retention choice and residual billing exposure, with an owner maximum total. No existing branch/backup/evidence deletion may finance the estimate. At present required resource/retention/fee facts are unverified, so NO final quote or spend request is ready.

## 6. Next bounded source-audit inventory

The following regular files are already positively identified by the saved pinned tree, not guessed paths. They have NOT been read in the completed pass. A new precisely bounded public-read decision and reviewed reader packet are required; do not reuse the old eight-call instance or permission.

- `clock-bound/src/shm.rs` — Git blob `7e52241b064f863d3d5a95f3d3339b9883c35871`, 52818 bytes.
- `clock-bound/src/shm/reader.rs` — Git blob `275608b099ac7dbed8d093857c3d8b717a1cea4d`, 34950 bytes.
- `clock-bound/src/shm/tsc.rs` — Git blob `a1d4b959d7f30106dcd1c06091a8a4ea6598d78a`, 3095 bytes.
- `clock-bound/src/vmclock/shm_reader.rs` — Git blob `b467c7dc654b9efdf02730bc4abf3982cb4dce26`, 25743 bytes.

Goal: establish delegated interval growth/validity, snapshot/mapping ownership/seqlock behavior and disruption reads sufficiently to produce a concrete connected bridge specification. If these files delegate further, report exact remaining gaps and make a design decision; no unbounded traversal or automatic extra fetch. No code/adoption/native run/provisioning is authorized by this audit inventory.
