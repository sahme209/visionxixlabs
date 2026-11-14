# Real Linux trial — minimum next phase and remaining owner decisions

Design/cost audit from saved local evidence only. No new research, account/API inspection, native execution/compilation, code, credentials, SQL, resources or spend. This note creates no authority. It separates the next L3 role-free gate from the full L4–L7 trial; it does not replace the full acceptance scope.

Sources: `../../BROWSER-VERIFIED-SETUP-PROPOSAL.md`, `../../FULL-TRIAL-COST-SUPPLEMENT.md`, `../ISOLATED-LINUX-EVALUATION-DESIGN.md`, `../EC2-BOUNDED-FOLLOWUP-RESULT.md`, and `../../aws-readonly-preflight/CONSOLE-SIGNED-IN-RESULT.json`. Paths are relative to this directory. The recorded account/Ohio network observations are historical, not a new exact-target preflight. No raw resource IDs are copied here.

## Recommended next resource boundary: L3 only

Use one dedicated ECS-on-EC2 host/root disk, one dedicated evaluation cluster and one fixed role-free executor task. Keep the trusted daemon/publisher in the host administrative zone and the original bounded reader/private initializer in the restricted executor. Use separate dedicated host/executor security groups and only the already observed VPC/subnet/route foundation if the exact network review accepts it. No default security group, SSH/ECS Exec, public application listener or arbitrary commands.

Do **not** create the Fargate PostgreSQL fixture, disposable provider target or replacement for L3. Protected time publication/reader behavior, runtime immutability, denied alternate caller, descriptor/path/lifecycle/disruption isolation, bounded cancellation and owned cleanup do not require a real application database or deployment. A fixed negative-test caller can be an isolated identity/process in the reviewed artifact; its exact placement is an artifact decision, not permission to add an agent or another host. Do not claim that role-free denial proves later credential-bearing custody.

L3 may collect raw native evidence with `time_authority=0`; it does not need an already qualified host profile merely to observe the owned trial. The protected source may become eligible only after the actual evidence satisfies the reviewed native premises and profile process. No bootstrap shortcut sets a successful qualifier to let the diagnostic start.

“Role-free” means no application/source/provider task credential or real credential acquisition. It does not mean ECS registration, image distribution or the provisioner needs no IAM. Any host registration/management identity, image-pull authority and administrative bootstrap identity need exact minimum policies and isolation; no broad instance profile, execution-role fallback, secret-store grant or ambient SDK chain is implied. L4 must later prove denial with the real selected credential boundary.

One host public address is an **illustrative** L3 network choice for reviewed host bootstrap/time/image reachability. It does not authorize inbound access or establish executor outbound reachability. Do not assume the host address supplies the chosen task network mode with external access. L3 should need only its fixed local protected channel; later provider egress must be explicitly designed and priced. No NAT, endpoint, proxy, registry/log service or additional observer host is silently included.

A separately authenticated external observer/provisioner is still needed for actual host/task/image/generation and lifecycle evidence. Prefer a qualifying existing control environment rather than another paid host, but its availability, identity, permissions, artifact/receipt transport and cost are **unestablished**. The signed-in browser observation alone is not that qualifier. A closed role-free trial needs no genuine-user TLS/app ingress; genuine requester/reviewer sign-in and authenticated private-handler ingress remain mandatory before L5.

## Saved-rate arithmetic, not a complete quote

Reuse only observed November13 Ohio Linux rates: m6i.large $0.096/hour, public IPv4 $0.005/address-hour, gp3 $0.08/GB-month. The instance type, Linux image and20GB disk are candidates, not qualified selections. Disk arithmetic assumes720hours/month.

| Enumerated L3 lifetime | USD |
| --- | ---: |
| One host compute for30minutes | 0.0480000000 |
| One public address for30minutes | 0.0025000000 |
| 20GB baseline gp3 for30minutes | 0.0011111111 |
| **Enumerated30-minute L3 subtotal** | **0.0516111111** |
| Separate additional30-minute host bootstrap + address + disk | 0.0516111111 |
| **Example60-minute host/address/disk total** | **0.1032222222** |

The30-minute trial window does not absorb unbounded build, boot, install, image-pull, observer or cleanup time. Set each duration separately. Disk retained24hours instead costs $0.0533333333 total storage, not an additional full24hours unless that is the chosen lifetime; retained30days costs $1.60. Public addresses and compute have their own actual lifetimes. No free credits, native hard billing cap, zero-price cluster/IAM assumption or deletion permission follows. A stop timer/budget alert is not a cap, and stopping compute does not prove credential closure or disk deletion.

The prior full-topology30-minute subtotal remains $0.0689536111 for one EC2 host, two small Fargate tasks, three addresses and20GB disk for30minutes. The separately enumerated bootstrap/replacement/disk example remains $0.1292359722. Neither is a full L3 or L4–L7 quote. Fargate worker-only diagnostic arithmetic in the supplement is historical and does not qualify the selected ECS-on-EC2/native time design.

## Decisions/facts to close once, before a bounded owner request

| Required exact fact/decision | Minimum resolution and resulting packet |
| --- | --- |
| Host/time support | Select exact Ohio instance/architecture/OS/AMI/root-disk minimum and establish its required clock/VMClock/PHC support. Saved m6i.large price is not support/capacity evidence. Do not deploy a guessed host to discover this. |
| Reproducible artifact | Freeze application revision, inspected upstream revision, exact reviewed patch/adapter and placement, daemon source/configuration, compiler/linker/sysroot/dependency/license inputs, C/Rust ABI, Node/private initializer, ECS agent/task image and entrypoints. Current adapters remain uncompiled. No public/default startup or unqualified constructor path. Identify all missing bytes first; no repeat release/source loop. |
| Build/bootstrap location | Choose existing approved local build environment or one explicitly priced builder/bootstrap environment; exact dependency acquisition and network scope, build commands, maximum duration/output and artifact hashes. Neither an installed compiler nor existing source approval authorizes compilation or dependency adoption. |
| Native premise acceptance | State how the selected artifact/profile will establish upstream bound/drift rounding, clock-domain/rate and conservative projection, actual producer generation/fail-stop, source descriptor identity, disruption and finalP2/later-use aging. Caller booleans/no-op facts and successful library return cannot issue this profile. Missing evidence ends the run unavailable. |
| Control and network | Fix external observer/provisioner identity, exact management permissions, one subnet/placement, security groups/rules, DNS/time/bootstrap/image and result-export paths, ECS network mode and metadata isolation. No inbound application ingress for L3. Quote any chosen proxy/endpoint/additional address/host. |
| Registry/artifact delivery | Choose a concrete path; bound compressed artifact bytes, upload/pull count, retention and requests. Existing ECR example price is not a selected service or complete registry quote. No silent execution-role or secrets grant. |
| Evidence/logs/transfer | Choose local owned output versus a selected managed service, maximum bytes/events/requests, transfer destination/volume, retention and retrieval. No invented log/transfer rate or presumed free allowance. Evidence export/cleanup must work without granting the executor broad network authority. |
| Resource and retention limits | Exactly one owned host/task/cluster set, finite bootstrap/trial/cleanup windows, fixed negative-case count, no replacement/retry/auto-repair; independent stop/terminal verification, disk/address/artifact retention and authorized cleanup targets. Unknown cleanup blocks success and retained charges remain explicit. |
| Complete numeric bill | Apply saved rates to all separate lifetimes plus selected image/log/request/transfer/retention/license/tax/contingency costs. Give owner a maximum proposed total and residual exposure, not a promise that AWS billing is hard-capped. Resource/price/retention decisions cannot remain TBD in a spend request. |

No new public research is automatically required for already saved rates. After service/traffic choices, the smallest conditional pricing scope is the official ECR pricing page if ECR is selected, CloudWatch pricing if managed logs/metrics are selected, EC2 data-transfer pricing for actual destinations/volumes, and EBS pricing only for snapshots/extra performance. A changed host/OS needs its own exact regional rate. Native support/AMI/availability and permissions need their distinct bounded evidence scope; do not disguise account inspection as pricing research. All consumed read grants stay consumed.

## One finite preparation packet, then one exact execution decision

Prepare one combined manifest from the decisions above: exact artifact/materialization/build plan; owned resource/IAM/network before/after diff; selected line-item quote; native positive/negative cases and refusal criteria; observer/receipt transport; one-invocation deadlines; independent stop/retention/cleanup. Collect unresolved facts in one bounded scope rather than asking to rediscover one fact per loop. Stop research when each item has evidence or an explicit unsupported finding.

The next owner request should name that exact frozen packet and may be conditional: first the specifically approved artifact build/inspection; only if it matches all pins and offline source/support prerequisites, provision and run the ONE expressly approved L3 trial; any failure or uncertainty stops the bundle without retry, new source, fallback, replacement, qualification or activation. Such a request is **not ready now** because artifact/support, control paths and unpriced quantities remain unresolved. This document is preparation, not that request or permission to perform it. If evidence collection itself needs new account/public access, bundle its finite destinations/operations separately in the same owner-facing decision; do not make uncertain results into automatic provisioning authority.

## Later full trial remains L4–L7

Only after accepted L3 evidence: qualify actual source/derived credential custody, inventory/renewal cutoff and retained unknown liabilities (L4); add the fresh isolated DB/session/vault and genuine independent humans with authenticated ingress (L5); add one measured baseline target and exactly authorized replacement/deployment/readback with separately priced overlap (L6); establish complete source/credential/effect closure, evidence retention and verified owned cleanup (L7). These phases require their exact resources, roles, costs and decisions. L3 cannot qualify their suppliers by simulation or grant production/default activation. Other families/platforms, ServiceNow human closure, production compatibility and the full master plan remain open. Governance stays first; visuals are deferred.


## Fixed-wire final review and completed documentation cost delta

File-only review of `FIXED-WIRE-DRAFT.md`: no important framing issue found. `AXIOM_TIME_CAPTURE_V1` is21ASCII bytes plus LF =22; six numeric lines are at most6×21 =126bytes; the4096 length line takes5bytes. Header maximum22+126+5 =153; exact record maximum4096; `END_CAPTURE` is11bytes plus LF =12. Total maximum **4261bytes**, below the independently enforced4608-byte envelope ceiling. Timestamp lines in the signed63 domain can be shorter; the stated bound remains conservative. The4096 publication ceiling remains separate. Exact-length record framing, one trailer/frame, EOF, successful owned-child reap and original hold/device/inode/generation/marker matching are required; syntax or matching stdout never establishes process provenance or time authority. The fixed descriptor map is source/IPC design only, not permission or proof for native open/close/exec, process isolation, liveness/disruption or quantitative clock premises. No implementation or native operation was performed by this review.

The primary agent reports the finite six-document pass completed. This review did not fetch/retry a page or inspect an account. Its pricing findings narrow the omissions but do not complete the quote:

- Official ECR examples use **$0.10/GB-month** storage. The observed same-region private ECR→AWS compute transfer line is0; this does not make image storage, all pulls/requests, cross-region/internet traffic or artifact delivery free. Exact registry choice, region, stored bytes, upload/pull count and retention still need binding. The example rate is not promoted here into a verified Ohio/account offer.
- CloudWatch prices vary by region; the observed **Virginia** example uses **$0.50/GB ingestion** and **$0.03/GB archive**. Those values must not be relabelled Ohio prices or multiplied into a final trial bill without the selected service/region/volume/retention semantics. Either select and fully quote managed logging or explicitly select a supported owned-output path; absence is a concrete design choice, not an assumed zero.
- The rendered EC2 pricing pages supplied **no Ohio egress numbers** for the required traffic. Bootstrap/image/evidence destinations and volumes remain unpriced where applicable. No guessed egress rate, repeated request or automatic fallback source follows.

The supported host/IP/disk L3 subtotal remains **$0.0516111111 for the enumerated30-minute lifetimes**, or **$0.1032222222 for60minutes**, before the still-unpriced components. The pass does not authorize new resources or spend, establish a hard cap, refresh old account observations or qualify native source/worker/host behavior. Freeze the actual missing quantities and paths once; use the recorded unsupported-price finding to request only an exact remaining quote dimension if selected, rather than repeating the consumed broad pricing pass. Full L4–L7, human/provider/closure and master acceptance remain unchanged.
