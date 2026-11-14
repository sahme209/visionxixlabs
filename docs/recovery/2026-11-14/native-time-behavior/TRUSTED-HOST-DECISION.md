# Owner decision: one practical trusted-host evaluation

**Recommendation:** accept a dedicated, controlled EC2/Linux host using the selected AWS-managed time source as an **explicit operational trust assumption for an isolated evaluation**, rather than require this trial to independently prove a universal physical UTC error guarantee. Keep production Governance disabled and its existing assurance contract unchanged. Do not implement another policy type that always returns None/Unknown while calling the actual missing authority solved.

In plain terms: trust the selected AWS host and its configured Linux time service for this controlled test, verify what we can actually observe, and clearly state what we cannot mathematically prove. This is a meaningful security-policy decision, not permission to invent an error margin.

## Decision requested — one coherent boundary

Approve preparation of **one complete host-evaluation packet** under this operating model:

- Dedicated Linux/x86_64 EC2 host, trusted administrative startup owner and AWS-managed time configuration; exact image/kernel/daemon/patch/runtime/source configuration is fixed before running.
- Closed source-bound executor on ECS-on-EC2, preserving the existing ECS task credential-origin contract. Do not substitute direct IMDS or the SDK environment/default credential chain. The initial evaluation is role-free and uses only synthetic owned resources.
- Trust AWS's selected source service and Linux's configured time machinery operationally; do not claim independently measured/proven worst-case physical B/D, global UTC enclosure, leap/smear equivalence or arbitrary future clock behavior.
- Native source status, generation/lifecycle/currentness, startup Unknown, disruption/correction invalidation, exact original resource binding, one-attempt ownership and genuine shutdown/cleanup still matter and remain required. Trust is not permission to skip those controls.
- Positive evidence remains scoped to this exact isolated host/configuration and test. ClockBound3.0.0-rc.0 is already accepted only as an isolated-evaluation candidate; this decision neither makes it stable nor adopts it for production.

This decision authorizes packet/design preparation only. It does not authorize resources, spending, code changes, actual clock steering, installation, signing, IAM, credentials, real database/provider actions or production enablement. Once the exact complete packet and full quote are reviewable, ask for **one conditional setup/evaluation/owned-cleanup decision** rather than separate permission for each harmless sub-check. Actual effects stay within that future exact grant.

## The alternative, and why the recommendation is practical

| Choice | What it means | Consequence |
|---|---|---|
| Recommended: explicitly trusted host/source evaluation | Trust the selected managed source/OS under a named test operating model; observe actual status, behavior and failures; acknowledge residual clock error/steering/provider trust | A finite real-host evaluation can proceed after exact resource/cost approval. It does not close the production quantitative-time contract. |
| Retain strict independent physical enclosure for this evaluation | Require genuinely accepted source-bound/model/rate/quantization/lifetime evidence before any usable clock policy | Keep the admitted lane unavailable until that evidence exists. More parser/private-type/Unknown-only code does not produce it. No delivery date can be honestly inferred. |

The owner is choosing a trust model, not being asked to calculate oscillator physics. The recommendation reflects a practical isolated operational trial. It is not a finding that the existing strict requirement was unnecessary or already met.

## Claimed source bounds versus actual measurements

These must remain separate in the packet and receipt:

1. **Source/OS assertions:** daemon-reported bound/drift/status, source configuration and the managed provider's actual documented assurances applicable to that configuration. They may be accepted operationally for the trial only under this explicit choice. Do not label them independently proven worst-case bounds.
2. **Actual native observations:** exact source association, producer startup/lifecycle/disruption, real record and raw clock samples, request/response timing, restart/step/failure behavior, protected file/descriptor ownership and process cleanup on the chosen host. Measurements establish the observed cases and can falsify a proposal; a finite test cannot prove a universal maximum UTC error or future drift limit.
3. **Policy:** any finite accepted use window/rate/error budget must be explicitly justified by applicable native/provider evidence and the selected operational model. No B, drift, lambda, maxAge or safety pad is selected in this document. The old 15ppm/1000s/default fallback is not revived. When the evidence is insufficient to justify such a parameter, record that exact missing value/contract; do not create it from successful samples.

The time-policy supplier is therefore the **separately accepted administrative host/source operating policy plus its exact observed/configuration evidence**, not a JSON loader, a hash, raw captures or a daemon's self-assertion. The accepting authority and protected storage/delivery must be explicit in the final packet. No new signer/key/reviewer identity is presumed.

## Do not silently weaken the current code contract

`executionTime.ts`, `NativeTimeSourcePorts`, `TimePremises` and the current private Rust policy were designed for qualified intervals. A trusted scalar OS time is not `[t,t]` with zero physical uncertainty. Do not inject it as such, bypass `nativeLinuxPorts.ts` refusals, mint AcceptedPreciseTimePolicy from an arbitrary value, remove first Unknown, or claim the existing interval contract passed.

If the isolated trial uses operational host time where quantitative premises remain unavailable, its execution policy must be a **separately named evaluation-only assurance mode**, with concrete consumer/closure semantics reviewed before implementation. It cannot activate a production default or reuse a strict-qualified label. Reuse original approval/claim/independent review/current permission/one-attempt and same-proof dispatch logic; do not create new authority or renew old deadlines. The precise code changes for that distinct mode are a consequence of the owner decision and must be consolidated into the same reviewed evaluation packet, not improvised during a run.

The previously accepted authorization-linearization decision is not approval to substitute clock assurance. A wrong host clock can accept an action before its not-before time, keep accepting after a real expiration, or incorrectly declare an external credential closed. Those are explicit residual risks of operational clock trust, even if the isolated cases pass. A separately typed assurance profile and history must preserve that distinction, and closure policy must be reviewed as part of the decision rather than silently removed.

External GitHub/AWS timestamps belong to other authorities. Provider-enforced expiration is useful enforcement, not proof that all unknown credentials are closed. Until strict conservative closure evidence exists, preserve unknown/source/derived liabilities rather than declaring closure from host time, compute shutdown or a local terminal row. The initial role-free run acquires no such credentials, so it can evaluate host behavior without pretending that gap is solved.

## Finite qualification deliverable

Prepare a single source-bound plan whose actual run produces:

- Exact host/AMI/kernel/architecture/source configuration and immutable artifact/runtime inputs; separate administrative producer and restricted read-only consumer resource delivery. Demonstrate actual startup invoking the existing patched private constructor, first Unknown before correction, and original generation retention.
- Role-free actual producer → immutable publication → already tested raw worker/parent → lifecycle/disruption/final-P2 observation, using the real Linux package. Preserve the passed raw/compiler evidence; do not rerun standalone source diagnostics as a substitute for the joined startup.
- Finite baseline/startup, unavailable source, owned restart/generation change, observed disruption/withdrawal, timeout and owned cleanup scenarios against that same source-bound package. Every attempt and uncertainty remains recorded; no automatic retry/restart or fabricated usable record.
- An evidence table distinguishing provider/source assertions, native measurements, accepted operational assumptions, still-missing quantitative premises and residual risks. The result may honestly accept only operational host behavior and leave strict production time qualification open.
- Exact owned stop/retention/cleanup and residual charge observations. A timer/budget alarm is not a billing cap; unknown cleanup remains a necessary human action, not speculative deletion.

This is the next useful real evidence. It avoids another None→Unknown-only implementation and does not require credentials, a provider deployment, real human approval or production state merely to evaluate the host/time startup.

## Existing setup and cost work — reuse, finish, do not guess

`../../2026-11-13/real-governance-qualification/BROWSER-VERIFIED-SETUP-PROPOSAL.md` already records the account/Ohio topology and selected trial architecture: one dedicated ECS cluster, controlled EC2 host/executor, separate role-free PostgreSQL fixture and target, four dedicated security groups. The default network observations are historical; default SG self-ingress/all-egress is not the selected security configuration. No cluster/resource/IAM/spend was approved by that inspection.

For the first role-free host/time evaluation, do not create the later PostgreSQL/target/custody/human components until the joined scenario actually needs them. Keep them in the complete later L0–L7 plan and quote; reducing the first running slice does not delete their requirements or price them at zero.

Before any setup/run request, the packet must finish these known facts:

- Actual supported AMI/OS/kernel/architecture, disk minimum, compatible instance/source configuration and capacity. Saved m6i.large price is only a candidate; PHC/VMClock/source support is not established by an instance price.
- Exact administrative/executor role and policy diffs, source-role separation and no direct-IMDS fallback; initial role-free means no hidden credential-bearing execution role, registry secret or broad instance profile.
- Artifact/image availability, bootstrap/image/DNS/time/provider reachability and corresponding explicit network rules. No NAT, load balancer, proxy, registry/log service or public listener is implicit.
- Real requester/reviewer ingress and independent observer placement for later phases; initial no-ingress host trial does not secretly solve the later genuine workflow.
- A full current scoped quote with fixed counts and separate bootstrap/test/cleanup/disk/IP/image/evidence retention lifetimes, requests/logs/transfer/taxes/contingency, and exact owned cleanup. The existing0.1292359722USD illustrative subtotal is incomplete and not authority; no free credits, budget hard cap or deletion permission is inferred.

These are already named setup facts, not newly invented security gates. Prepare them together, then seek the smallest complete resource/spend approval. No further provider read or paid creation is authorized by this decision packet itself.

## Existing evidence reused

- `../native-worker-local/GOVERNANCE-READINESS.md`: fixed G1–G6 tracker; raw behavior does not establish G3/G4/whole Governance.
- `../../2026-11-13/real-governance-qualification/design/ISOLATED-LINUX-EVALUATION-DESIGN.md`: existing administrative separation and L0–L7 sequence.
- `../../2026-11-13/real-governance-qualification/design/linux-artifact-integration/CLOCK-AUTHORITY-ALTERNATIVE-REVIEW.md`: explicit operational managed-authority trust is a changed assurance decision, not an equivalent quantitative clock adapter.
- `../../2026-11-13/real-governance-qualification/design/linux-artifact-integration/PRECISE-ORIGIN-CORRECTION-DESIGN.md`: actual remaining B/D/rate/quantization/lifetime evidence and no invented defaults.
- `../../2026-11-13/real-governance-qualification/design/EC2-BOUNDED-FOLLOWUP-RESULT.md`, `../../2026-11-13/real-governance-qualification/FULL-TRIAL-COST-SUPPLEMENT.md` and the browser-verified setup proposal: dated regional arithmetic and unresolved full quote.

**Recommended owner response:** accept this explicit trusted-host operating model for preparation of the isolated evaluation packet, keeping production strict assurance/activation and all actual resource/spend approvals separate. If strict independent physical guarantees are required even for the isolated trial, retain the current refusal and identify the genuine external evidence source instead of building another empty supplier.
