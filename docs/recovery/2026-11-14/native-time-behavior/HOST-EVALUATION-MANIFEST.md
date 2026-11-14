# L3-only trusted Linux host evaluation — candidate manifest

Local document preparation only. The accepted isolated operating model trusts AWS-managed ordinary NTP and the selected Linux host operationally; it does not prove independent physical UTC bounds. No resource, permission, code, runtime, credential, production or spending action is authorized by this manifest. It is **not ready to run and not a complete quote**.

## Fixed evaluation slice

Proposed substage for the final combined-manifest decision, not an already accepted replacement of the ECS-on-EC2 topology: one newly owned EC2 host in the existing approved test-account context, region `us-east-2`, running only the source-bound protected producer/startup and existing worker/parent observation scenarios. No ECS cluster/executor task, PostgreSQL fixture, deployment target, provider task role, customer data or real credential is required for this L3 slice. Those remain in the later custody/human/provider plan; this document does not remove them.

| Coordinate | Candidate / exact observed fact | Remaining qualification |
|---|---|---|
| Instance | `m6i.large`, Linux/x86_64, saved Ohio rate$0.096/hour | Actual capacity/eligibility, exact instance configuration and supported source/runtime fit are not verified |
| Time source | Ordinary local Amazon Time Sync Service NTP at169.254.169.123; AL2023 default per `HOST-PUBLIC-SUPPORT.md` | Bind and observe actual configuration/status; NTP leap smearing is explicit. No PHC/precision-time claim or silent source fallback |
| AMI | Ohio public image `ami-001cbfee94278a792`, name `al2023-ami-ecs-hvm-2023.0.20260901-kernel-6.1-x86_64` | Exact image identity observed, not claimed newest/recommended; freeze/verify exact metadata before setup |
| Image provenance | ownerAlias `amazon`, owner591542846629, created2026-09-02; EBS/HVM/ENA/uefi-preferred | Full block mapping, root snapshot/size, kernel/runtime/agent/package versions and actual launch state remain to bind |
| Root disk | Official ECS-optimized AL2023 **30GiB** baseline, gp3 baseline performance | Check exact image block mapping; do not shrink to old20GB illustration or assume30GiB holds the final artifact |
| Network | Reuse historical known test VPC/subnet/route only after exact target recheck; one dedicated evaluation SG, no ingress | Final subnet/route/SG identities and necessary egress must be frozen; default SG is not selected |
| Credentials | No application/task/customer/provider credential on evaluated host | Any management or artifact-delivery capability must be separately named and approved; never imply an instance role is role-free |

The image's ECS optimization does not require starting an ECS workload for this first host slice. Disable/unconfigure automatic cluster joining in the reviewed bootstrap rather than implicitly creating a cluster/role. No direct host-IMDS substitute for the later ECS task-credential acquisition contract is introduced.

## Finite native deliverable

Use the actual existing producer patch and raw bridge; do not repeat standalone compiler/source exploration. Record one joined startup with first Unknown before adjustment, ordinary NTP source association, actual generation/publication/resource ownership, raw worker/result/owned cleanup/final P2, and fixed unavailable-source/restart/disruption/timeout scenarios approved in the eventual exact packet. Keep observed measurements separate from source assertions and operational trust. No invented B/drift/lambda/maxAge or zero-width qualified interval; missing physical premises do not become positive evidence.

Observe only the selected L3 source/resource/process behavior. No credentials, synthetic approvals pretending to be people, provider send, full Governance activation or strict credential-closure claim. Native outcomes and liabilities are never reset/replayed to obtain a pass.

## Four concrete setup dependencies still unresolved

1. **Management/observation path.** Recommended minimal candidate is one fixed nonsecret EC2 user-data bootstrap, no SSH/key pair/listener and no instance profile, with a fixed owned completion receipt retrieved through the externally authorized EC2 management plane. This is a proposal, not proof that console output supports the required complete bounded receipt. Bind actual output availability/size/retention, process/producer supervision, deadline and recovery method before choosing it. Bind exactly one clock-steering owner: specify default chrony coexistence or exclusion, detect alternate writers and invalidate publication during disruption; do not allow a custom steering daemon and default service to silently compete. If SSM is selected instead, explicitly add its exact management instance role/policies, agent configuration, network endpoints and charges; it is not an invisible role-free fallback. Do not install an agent or grant FullAccess to discover feasibility.
2. **Exact artifact delivery.** The prior compiler outputs were not retained as reusable artifacts; do not claim they are already hosted. Select one immutable source-bound package/build, exact byte size/hash, compression and bounded download/disk requirements. Freeze its origin, publication/storage/download/retention charges, signature/hash verification and bootstrap tool availability. A public immutable artifact would avoid a host application role, but publication is an external action requiring approval; a private presigned URL is itself a scoped capability with lifetime/handling requirements. Neither route is selected/authorized here. No GitHub Actions artifact retention/download is assumed free or already approved.
3. **IAM/network manifest.** Freeze exact external operator actions for image/instance/network inspection, creating only the new SG/instance/disk/address if selected, observing status/receipt, and stopping/terminating ONLY that owned host. Distinguish operator authority from host runtime permissions. Specify no instance profile for the preferred initial candidate, no key pair, no public inbound ports, and exact artifact/DNS/NTP/management egress requirements. TLS443 is not hostname isolation. Any proxy, NAT, endpoint, S3/ECR/SSM/log service or public address is a separate explicit item, never an implicit convenience.
4. **Owned cleanup and evidence retention.** Specify exact new-resource tags and immutable IDs, external maximum-lifetime stop enforcement, process cancellation/quiescence, receipt export, retained copies and owner-confirmed cleanup. Bind delete-on-termination for the NEW root disk only if expressly approved; preserve every existing disk/database/backup and original attempt. Termination without verified ownership or export is not speculative cleanup. Unknown cleanup stops for inspection and retains remaining cost exposure.

Resolve these together in one exact executable setup/evaluation/verify/cleanup packet. Do not create wrappers or resources merely to discover a delivery path.

## Cost worksheet and finite limits to finalize

Reuse saved rates only: m6i.large$0.096/hour; publicIPv4$0.005/address-hour if actually selected; gp3$0.08/GB-month,720hour arithmetic month. At30GiB baseline, disk alone is$0.0033333333 for60minutes, $0.08 for24hours, or$2.40 for30days. One60minute host + one60minute IPv4 +30GiB disk60minutes enumerates **$0.1043333333**, before all outstanding items. This is derived illustration, not a complete bill, spend allowance, hard cap, capacity offer or free-credit assumption.

A practical packet can propose one host/one attempt with separate bootstrap, native evaluation and cleanup budgets within a finite host lifetime, plus a separately priced evidence/disk retention window. Final numeric durations must match actual artifact size/bootstrap and external stop feasibility; a process timer or budget notification is not a hard AWS billing cap. Include image/artifact build/publication/pull/storage, management/observer, requests/logs/transfer, cleanup delay, retention, taxes and contingency, or prove each absent. Do not reuse the old full-topology subtotal as this L3-only quote.

## Authorization status and next owner action

Accepted: isolated ordinary-NTP AWS/Linux operational trust for preparing this host packet; prior source/compiler/raw behavior evidence at their exact recorded scope. Unapproved: actual setup/resources/IAM/clock/runtime/install/artifact publication/credentials/spending. Exact AMI observation does not grant any of them.

Next: close the four dependencies and produce one full bounded quote and reviewed run packet. Then obtain one conditional owner decision naming exact inputs/resources/limits/owned cleanup. No run-ready or Governance-complete claim follows from this manifest.

References: `HOST-PUBLIC-SUPPORT.md`, `HOST-SETUP-COST-GAPS.md`, `TRUSTED-HOST-DECISION.md`; existing `../../2026-11-13/real-governance-qualification/BROWSER-VERIFIED-SETUP-PROPOSAL.md` and `FULL-TRIAL-COST-SUPPLEMENT.md`. No new public or account read occurred in preparing this file.
