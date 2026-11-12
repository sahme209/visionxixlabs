# Axiom future technology assessment — owner review draft

Reviewed source: `9decdb2891e89d1fa802cf325a45bd1e0c1e568f` (November 11, 2026). Research only: no adopted dependencies, implementation tickets, grants, settings, infrastructure, inference or deployment. Recommendations are judgments for owner review, not authorized work. This covers all eight requested areas; it is not a certification, market-demand study, live compatibility test or completion of the master plan.

## Recommendation

Keep Axiom as the evidence, approval and outcome control plane. Integrate with customers' existing execution systems instead of replacing Kubernetes, an IaC engine, GitOps controllers, a monitoring backend and a model server. Finish current production-target reconciliation, exact execution/custody qualification, human approval and real-world acceptance first. Broad catalog coverage would not resolve those gates.

Next candidates to discuss with design partners: (1) one read-only release-health adapter, preferably an existing customer Prometheus/Grafana or OpenTelemetry destination; (2) one Kubernetes/Argo CD evidence adapter; (3) a Backstage ownership reader. This ordering is inferred engineering reuse/value, not verified customer demand. Terraform/HCP, Vault, OPA, Kubernetes, Backstage, observability and CI systems are already in the roadmap; do not create duplicate tickets. Offline model access now has accepted v1 ADR choices; implementation and live qualification remain open.

## Evidence method and support legend

Read current runtime contracts, handlers, guards and selected tests, not just package names, marketing copy or static `live` labels. `source-evidence.json` binds the inspected files. Scope: current cloud/plugin/connector registries, ReleaseOps and Terraform paths, orchestration contracts, governance readiness, audit/observability and the existing roadmap/ADRs. Searches across tracked runtime surfaces identify candidates for inspection, not proof that an entire repository lacks a capability.

- **P — partial source:** implementation exists for the described narrow operation. Does not establish deployment, credentials, compatibility with every version or live acceptance.
- **R — planned:** explicit roadmap/ADR; not accepted operational support.
- **N — not established:** no accepted integration identified in the reviewed surfaces. Treat as unsupported for customer promises until positively verified, not a universal absence proof.
- **G — gated:** source deliberately refuses or an owner/qualification gate remains.

The last verified production receipt is build 4 at `a344f4f6`; later merged source is not automatically deployed. Existing governance source has an uncovered P01 scope decision and disabled execution boundaries. The named ServiceNow note must never be resent. No research recommendation changes those facts.

## Verified reusable foundations

| Evidence | What source establishes | What it does not establish |
|---|---|---|
| S1 `lib/releaseops/awsEcsDeployWorkflowTemplate.ts` | GitHub workflow template using OIDC, ECS stability checks and attempted task-definition rollback | Fleet-wide canary support or restoration of an immutable previous image; mutable tags can resolve differently |
| S2 `lib/releaseops/ecsReleaseV2/reviewCore.ts` | Exact target/evidence/policy review contracts; `ECS_REVIEW_EXECUTION_ENABLED=false` | Enabled execution, live qualification or universal deployment admission |
| S3 `lib/terraform/customerPlan{Http,Runtime,Service}.ts` | Scoped customer plan evidence/profile/read boundaries, producer/source/budget checks; HTTP guidance says approval/apply unavailable | Hosted Terraform/HCP service or an authorized apply operation |
| S4 `lib/terraform/runner.ts` | Legacy init/validate/plan refuse; independent default-off apply switch | Permission to enable or reuse legacy apply |
| S5 `lib/releaseops/driftDetector.ts` | Pure declared-versus-observed comparison; typed cloud/Kubernetes/Helm/resource kinds | Complete provider collectors or automatic reconciliation |
| S6 `lib/cloud/capabilityCoverageMap.ts`, `lib/cloud/aws/awsServiceInventoryExtractor.ts` | Coverage metadata/previews; bounded gated AWS inventory including Lambda | SDK presence or preview GKE data proving EKS/AKS/GKE deployment support; static labels proving current production access |
| S7 `lib/releaseops/providers/{github,gitlab,azureDevOps}Projectors.ts` | Normalization of selected PR/pipeline/tag payloads | OAuth, sign-in, current live ingestion, deployment or provider writes for every named system |
| S8 `lib/orchestrator/contract.ts`, Argo client | Engine-independent observation profiles; Argo Workflows namespace-scoped GET only | Argo CD sync, or submission/cancel/retry through these read-only profiles |
| S9 `lib/governance/intelligence/uncoveredFamilies.ts`, handoff | Readiness blocked by P01; remaining real-world and owner gates recorded | Complete/activated Governance, or a policy engine replacing current enforcement |
| S10 `lib/audit/sealAnchorKernel.ts` | Content-free externally retained seal anchor contract | Tamper resistance against rewriting both database and unprotected anchors; independent security certification |
| S11 `lib/observability/metrics.ts` | In-process counters and taxonomy; explicitly no shipped Prometheus/StatsD exporter in this module | Durable cross-instance metrics, complete OTel collector or Grafana integration |
| S12 `lib/releaseops/ecsReleaseV2/sigstoreBuildVerifier.ts` | Provenance binding to exact artifact/source/workflow and reviewed trust profile | Safety of signed behavior, universal artifact acceptance or automatic trust-root refresh |
| S13 A9/offline-AI ADRs | Proposed on-prem contract; custody, sign-in, license and retention held; offline model choices accepted November11, implementation pending | Air-gap readiness or permission to supply/host model servers |

## Technology-by-technology treatment

Each row includes all named technologies sharing its boundary. “Later” means consider after current gates and customer evidence; “monitor” means watch without implementation. Risk profiles below supply architectural dependency, security, maintenance and cost treatment for every row. Complexity is a relative engineering judgment, not a quote or paid-service approval.

### 1. Containers and orchestration

| Technology | Current evidence/status | Customer value and approach | Judgment / risk |
|---|---|---|---|
| Kubernetes | R/N; connector registry explicitly planned, S5 resource vocabulary only | Read exact cluster/namespace/workload UID, desired revision, observed status and freshness; later govern narrowly scoped changes | Later / C |
| Docker | P as CI/packaging tooling, not a general customer runtime | Verify image digest/provenance through existing artifact contracts; avoid a new daemon-control API | Reuse evidence now; daemon actions later / C |
| containerd | N as a customer integration | Prefer standard artifact/cluster evidence over direct privileged daemon access | Monitor / C |
| Amazon ECS | P/G S1–S2 | Finish exact source/image/target review and real deployment/outcome acceptance before expanding | Current completion first / C |
| Amazon EKS, Azure AKS, Google GKE | R/N for accepted cluster operations; SDKs/previews are insufficient (S6) | Managed-cluster metadata plus tenant-bound Kubernetes access; qualify each cloud identity path separately | Later / C |
| Helm, Kustomize | N for accepted execution; Helm is a drift resource kind (S5) | Bind rendered manifests, chart/base/dependency digest and target namespace to the review; distinguish rendering from applying | Later / C |
| K3s | N | Support through the same tested Kubernetes contract when a customer requires it; no special distribution fork initially | Monitor / C |
| Multi-cluster orchestration | N | Per-cluster exact scope, staged partial outcomes and recovery; no single fleet-wide approval inferred from one cluster | Later / C, very high |

[Kubernetes objects](https://kubernetes.io/docs/concepts/overview/working-with-objects/) distinguish desired configuration from observed status. Inference for Axiom: a rendered manifest or successful API submission alone is not a verified rollout. ECS's own [deployment model](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html) is task replacement controlled by service settings; it does not qualify every Axiom release strategy.

### 2. Infrastructure automation

| Technology | Current evidence/status | Customer value and approach | Judgment / risk |
|---|---|---|---|
| Terraform / Infrastructure as Code | P/G S3–S4 | Reuse saved-plan provenance and exact state/backend/source bindings; complete producer/approval/apply gates, not legacy text approval | Current completion / I |
| HCP Terraform | R | Integrate run/plan/policy evidence and later exact approved run actions; keep hosted product authorization separate | Later / I |
| OpenTofu | R format-parity milestone | Qualify plan format, provider versions, sensitive fields and backend semantics separately; do not assume Terraform byte equivalence | Later / I |
| Pulumi | R/N accepted adapter | Read stack/update evidence first; a programmatic engine remains an executor that needs Axiom admission | Later / I |
| Crossplane | N | Read composition/revision/reconcile status first; controlling a desired resource can cause many later effects | Monitor / I, very high |
| Ansible / configuration management | R/N accepted executor | Import job/inventory/playbook digests and host results; later use a fixed reviewed execution environment | Later only with demand / I |
| Drift detection | P S5 | Feed current, source-bound declared/observed snapshots into the existing kernel | Reuse kernel, qualify collectors / I |
| Drift reconciliation | N accepted autonomous repair | Prepare a separately reviewed change; finding drift never authorizes repair or a recurring controller | Later / I, high |

[Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan) and [OpenTofu plan](https://opentofu.org/docs/cli/commands/plan/) describe proposed changes; plans can still involve remote reads and sensitive values. [Pulumi Automation API](https://www.pulumi.com/docs/iac/concepts/automation-api/) and [Ansible Runner](https://docs.ansible.com/projects/runner/en/stable/) offer integration surfaces, not Axiom authority. [Crossplane compositions](https://docs.crossplane.io/latest/composition/compositions/) generate/manage groups of resources; the indirect-effect scope would need explicit review.

### 3. CI/CD and GitOps

| Technology | Current evidence/status | Customer value and approach | Judgment / risk |
|---|---|---|---|
| GitHub Actions | P S1/S7 | Extend current exact repository/workflow/run-attempt/artifact evidence; keep CI acceptance distinct from deployment approval | Reuse / D |
| GitLab CI/CD | P payload projectors, R connector/login | Separate account sign-in, workspace repository consent, pipeline observation and governed writes | Later / D |
| Azure DevOps | P projectors, R operational integration | Qualify organization/project/repository/build IDs and permissions separately from normalization | Later / D |
| Jenkins, AWS CodePipeline | R/N accepted adapters | Start bounded build/artifact observation from fixed tenant endpoints; no arbitrary Jenkins URL or credential-bearing logs | Later / D |
| Argo CD, Flux | R/N accepted GitOps integration | Read commit/reconciliation/health first; later bind exact sync intent and recurring effects to admission | Later / D, high |
| Harness, Spinnaker | R/N accepted adapters | Integrate existing customer pipeline execution and verification evidence instead of rebuilding their delivery engines | Later with demand / D |
| Canary, blue-green, progressive delivery | N general accepted support | Delegate traffic shifts to a reviewed existing controller; bind health thresholds, observation window, stop/rollback owner and permitted effects | Later / D, very high |
| Rollback | P attempted ECS task-definition rollback, not universal | Preserve exact prior artifact/configuration, verify health afterward, retain unknown outcomes; database rollback remains separate | Finish current evidence / D |

[GitLab CI](https://docs.gitlab.com/ci/) is a staged jobs/pipeline system; a payload projector is not its complete integration. [Argo CD automated sync](https://argo-cd.readthedocs.io/en/latest/user-guide/auto_sync/) has distinct sync/prune/self-heal semantics, so one manual review cannot silently authorize all later reconciliation. [Argo Rollouts](https://argo-rollouts.readthedocs.io/en/stable/) supplies progressive-delivery mechanisms; assessment recommendation is interoperability, not installing a controller now. Argo Workflows observation (S8) is a different product boundary.

### 4. Modern application deployment

| Technology | Current evidence/status | Customer value and approach | Judgment / risk |
|---|---|---|---|
| Serverless / FaaS; AWS Lambda | P gated Lambda inventory (S6), N general accepted mutation | Add version/alias/config/artifact evidence before exact deploy; qualify cold-start, concurrency and rollback observations per provider | Later / T |
| Azure Functions, Google Cloud Run | N accepted deployment path in inspected surfaces | Extend common evidence schema with each provider's identity/revision/traffic semantics, rather than aliasing ECS | Later / T |
| Virtual machines / traditional app servers | P inventory concepts; N generic accepted deployment | Import versioned agent/job evidence; avoid unrestricted SSH/shell as a convenience fallback | Later / T |
| Hybrid, private cloud, on-premises | R/G S13 | Complete offline identity, entitlements, custody, supply-chain/upgrade and backup design first | Owner decisions then qualification / T |
| Edge / distributed deployments | N | Require signed offline evidence, clock/freshness rules and partial connectivity recovery | Monitor / T, very high |
| WebAssembly / lightweight runtimes | N Axiom executor | Candidate for bounded pure transformations, not a shortcut around current native custody requirements | Monitor / T |

[WASI](https://wasi.dev/) defines portable host interfaces for WebAssembly. Portability is not evidence that Axiom's database, credentials, native helpers or arbitrary plugins are isolated correctly. Recommendation: do not rewrite the runtime just to adopt a fashionable execution format.

### 5. Platform engineering

| Technology | Current evidence/status | Customer value and approach | Judgment / risk |
|---|---|---|---|
| Internal developer platform / self-service portal | P existing Axiom workspace/workflow UI, N broad IDP parity | Keep clear scope→evidence→review→execute→outcome; avoid becoming a second general portal | Reuse focused UX / P |
| Backstage | R | Read ownership/service/environment metadata, reconcile to actual Axiom tenant and roles; do not import authorization from labels | Later / P |
| Golden paths / reusable templates | P workflow template S1; platform hosting scope P01 unresolved | Version and sign template inputs/artifacts; expose explicit supported operations and approval owners | Scope decision first / P |
| Multi-cloud deployment management | P discovery/model concepts, N uniform accepted execution | Normalize evidence, not provider semantics; show actual per-cloud coverage and unknown states | Later / P, high |
| Environment provisioning / lifecycle | P target/environment source, G full operational coverage | Reuse existing environment identity and grants; lifecycle includes deletion, rotation and revocation, each explicit | Finish current boundaries / P |

[Backstage's catalog](https://backstage.io/docs/features/software-catalog/) tracks software ownership/metadata. Axiom can consume that context without copying its entire portal or accepting a catalog owner field as a security role.

### 6. AI-native infrastructure

| Technology | Current evidence/status | Customer value and approach | Judgment / risk |
|---|---|---|---|
| Model deployment / inference serving | R/G accepted customer-hosted ADR; current governed Gateway source exists | Distinguish calling an existing model from deploying/operating it. Offline calls require implementation of the accepted mode/endpoint/operator-token-budget policy | Accepted local implementation next / A |
| KServe | N accepted integration | Read model/artifact/runtime/route evidence via Kubernetes adapter after that base qualifies | Monitor, later with demand / A |
| KubeRay | N | Integrate Ray job/service/cluster evidence only for actual customers; do not add a distributed compute control plane | Monitor / A |
| GPU orchestration | N | Separate compute quota/cost, scheduler and model data custody; no automatic cluster purchase | Monitor / A, very high cost risk |
| Model versioning, monitoring, rollback | N complete model lifecycle | Bind model/weights/runtime/config version and evaluation evidence; rollback may not reproduce earlier outputs | Later / A |
| AI agent deployment/lifecycle | P gateway/identity/audit source, G full enforcement | Finish current identity, admission, revocation and exact execution first; cooperative reporting is not an OS boundary | Current completion / A |
| Intelligent planning/troubleshooting | P bounded governed extraction + deterministic evidence | Source-cited proposals, not inferred authority; measure quality/latency/cost and correct refusals | Reuse, measure / A |
| Predictive failure detection / automatic remediation | N validated predictor/autonomous repair | Require representative data, false-positive/cost evaluation and separately admitted corrective effects | Monitor; avoid unsupervised rollout now / A |

[KServe architecture](https://kserve.github.io/website/docs/concepts/architecture) separates management and inference. [KubeRay](https://docs.ray.io/en/master/kuberay/index.html) manages Ray resources; the linked master documentation is evolving, not a version qualification. These tools do not resolve Axiom's pending customer-hosted inference policy or supply safety evidence for an autonomous repair.

### 7. Security, networking and observability

| Technology | Current evidence/status | Customer value and approach | Judgment / risk |
|---|---|---|---|
| Zero trust / least privilege | P scoped checks and refusals, G complete custody/live assurance | Continue threat-model, revocation, boundary and independent assessment work; no absolute-security label | Current completion / S |
| OPA / Policy as Code | R | Bind policy/data versions, exact inputs, decision freshness and failure behavior into existing admission; no second approval store | Later / S |
| Kyverno | N accepted adapter | Read reports first; mutation/generation/deletion/admission hooks have separate operational effects | Later after Kubernetes / S |
| SBOM / artifact signing / supply chain | P workflows and S12 verifier | Reuse exact artifact/source/trust-root bindings; inspect provenance and vulnerability evidence, not signature alone | Finish qualification / S |
| Secrets management / Vault | P existing vault/credential boundaries; R enterprise Vault | Broker scoped references and lease/revocation evidence; never copy secret values into prompts or evidence bundles | Later after custody choices / S |
| Workload identity | P ECS OIDC template, N universal identity federation | Qualify issuer/audience/subject/expiry per provider; preserve short-lived scoped use | Reuse exact existing path / S |
| eBPF / Cilium | N | Read network-policy/flow evidence through a least-privilege adapter before any node/cluster-level change | Monitor / S, very high privilege |
| OpenTelemetry | N accepted exporter in S11 | Export bounded, redacted correlated signals; explicit destination/retention and no prompt/secret export by default | Consider early evidence-only integration / O |
| Prometheus / Grafana | R; local counters not full exporter | Read release-scoped health windows and SLO evidence from customer systems, distinguish missing/stale from healthy | Consider early / O |
| Compliance evidence / audit trails | P seal/anchor/evidence kernels, G real assurance | Maintain external anchors, source coverage and audit-retention choices; audit logs alone do not prove compliance | Finish evidence/independent review / S |
| Disaster recovery / resilience | P backup/check contracts and historical receipts, G current target/recovery acceptance | Verify actual target, tested restore and additive cutover before deploying; no historical receipt substitutes for current recovery | Immediate existing gate / S |

[OPA](https://www.openpolicyagent.org/docs) separates decisions from enforcement. [Kyverno](https://kyverno.io/docs/introduction/) manages policy effects; neither is an independent human reviewer. [Sigstore](https://docs.sigstore.dev/about/overview/) provides signing/verification tooling, not a judgment that signed behavior is safe. [Vault](https://developer.hashicorp.com/vault/docs/about-vault/what-is-vault) addresses secrets management; integrating it creates a new custody/lease boundary. [Cilium](https://docs.cilium.io/en/stable/security/) is a networking/security system, not a cosmetic observability plugin. [OpenTelemetry](https://opentelemetry.io/docs/) offers vendor-neutral telemetry; telemetry is not approval or causal proof.

### 8. Emerging technologies and 3–5 year outlook

| Technology / trend | Current evidence/status | Customer value and approach | Judgment / risk |
|---|---|---|---|
| Event-driven architecture | P existing webhooks/audit events; N universal orchestration | Preserve tenant-bound event IDs, deduplication, ordering/unknown-delivery semantics and admitted downstream effects | Extend existing contracts / D |
| Autoscaling / KEDA / workload-based scaling | N accepted scaling control | Read scaler decisions and queue/workload evidence first; bounds, cooldown and cloud-cost authority must be explicit | Monitor / C/O |
| Multi-cloud / hybrid orchestration | P common models, G complete cross-domain execution | Prefer independent provider adapters with visible partial outcomes to a universal deploy button | Later / T/P |
| AI-assisted platform operations | P proposals/evidence, G full operational authority | Start explainable diagnostics and human-reviewed exact changes; benchmark against deterministic alternatives | Reuse carefully / A |
| Autonomous deployment with human gates | P contracts, G full execution/acceptance | Scope autonomy limits explicitly, retain genuine review, current revocation and one-attempt records; do not confuse human approval with unlimited subsequent controller behavior | Existing gates first / A/D |
| Other emerging runtimes and agent protocols | N outside reviewed contracts | Monitor interoperability, capability attenuation and supply-chain maturity; adopt only after a concrete supported customer task and bounded design | Monitor / T/S |

[KEDA](https://keda.sh/docs/2.21/) offers event/workload scaling integration. It is not needed merely to display batch status. Forecast (not a fact): interoperability, exact provenance, offline boundaries and cost-aware admission are likely more durable investments than building another scheduler over the next 3–5 years. Revisit at product milestones or on design-partner evidence, not because a technology is popular.

## Shared risk, architecture and usability profiles

Every row inherits tenant isolation, exact actor/target/source/policy/approval bindings, request/output/page/time budgets, current revocation, bounded cancellation, durable unknown outcomes and no blind replay. Start with read-only evidence and explicit availability; add execution only through reviewed current authority. Do not reuse an old approval across a new provider, target, revision or recurring effect.

| Profile | Dependency / security boundary | Maintenance, cost and complexity | Nontechnical experience |
|---|---|---|---|
| C cluster/runtime | Cluster UID, namespace, workload revision, scoped service identity, artifact digest; daemon access separate | High; API/version/RBAC/controller compatibility, clusters/registries/network, many partial failures | Name cluster/namespace, show desired vs observed and exact next actor; never hide unknown health |
| I IaC/configuration | Exact plan/program/provider/backend/state/inventory versions; no embedded secrets; isolate execution | High; plugins/toolchain, state locks, drift, sensitive output, hosted subscriptions and cloud changes | Explain proposed effects and stale plans; separate plan, approval and apply |
| D delivery | Repository/commit/run-attempt/artifact/environment/traffic policy; recurring effects require own scope | High; vendor API/webhook semantics, retention, runners, release controllers; rollback not free or guaranteed | One current stage with owner, evidence and stop/recovery outcome |
| T deployment target | Provider revision/alias/region/account, runtime identity, offline clock/freshness and rollback compatibility | High–very high; provider-specific APIs, networks, offline updates, multi-region incidents | Supported-operation matrix and target summary, not a vague multi-cloud promise |
| P platform/catalog | Tenant-bound service/environment ownership; metadata cannot confer privileges | Medium read-only, high provisioning; mapping drift, catalog quality, template lifecycle and hosted services | Reuse Axiom navigation; link to customer catalog instead of duplicating portals |
| A AI/model | Current AI policy, endpoint allowlist, exact model/input/output bounds and token/cost admission | High–very high; evaluation, GPU serving, weights/licenses, model drift, unknown usage and inference fees | Separate a proposal, permission, execution and verified result; disclose online/offline data path |
| S trust/security | Audited role/lease/key/trust roots and signed source binding; genuine external review still needed | High; rotations, expiry, tampering, incident/restore exercises, independent assessment | Explain implemented/tested/assessed/planned controls without “unhackable” claims |
| O telemetry | Tenant/resource/time-window labels, redaction, freshness, consent and data retention | Medium read-only, high exporter scale; cardinality, ingest/storage/egress, absent/stale data | Health evidence for this release with coverage limits, not a wall of graphs |

Costs here are risk categories; no spend estimate, benchmark or commercial licence approval was obtained. A product API or open-source licence does not make hosted operation free. Exact versions, licences, vulnerabilities, support matrices, API quotas, deployment topology and data-export terms must be reviewed before any adoption.

## Owner-review shortlist and unresolved evidence

1. **Reuse now, no new system:** existing deterministic retrieval, versioned evidence, scoped collectors and audit/outcome contracts. Finish already-approved core acceptance.
2. **Consider next:** one customer-selected telemetry reader; Kubernetes/Argo CD evidence; Backstage ownership. First validate demand, then reviewed read-only designs and live acceptance. Existing roadmap already contains these families.
3. **Later:** HCP/OpenTofu, Vault, OPA, GitLab/ADO/Jenkins/CodePipeline, progressive delivery and serverless adapters, each with a narrow effect model.
4. **Monitor:** Crossplane, KServe/KubeRay/GPU scheduling, KEDA, WASI/edge and multi-cluster autonomy. Do not install or build them now.
5. **Avoid now:** unrestricted shell/daemon fallback; universal approvals; duplicate policy/audit/credential stores; unsupervised remediation; a new generic cloud/model hosting business without customer evidence.

Missing: live customer-demand interviews, version-by-version interoperability, independent security testing, representative benchmarks, deployment/restore proof, current production target reconciliation and owner decisions. No production readiness score is asserted. This is a first source-backed assessment for review, not completion of those operational gates or an authorization to implement recommendations.

## Industry context and forecast limits

The [CNCF/SlashData Q3 2026 research summary](https://www.cncf.io/reports/the-state-of-cloud-native-development-q3-2026/), published November 10, 2026, discusses cloud-native, AI and platform-engineering adoption. The [CNCF annual survey](https://www.cncf.io/reports/the-cncf-annual-cloud-native-survey/) also places Kubernetes within existing production practices. These are ecosystem samples/summaries, not proof that Axiom's customers need every integration or that one runtime should replace another. No survey percentage is used as an Axiom sales metric.

[DORA's 2025 research summary](https://dora.dev/research/2025/dora-report/) describes AI as amplifying organizational strengths and weaknesses. Inference for this project: invest first in clear scope, reviewable evidence, reliable delivery and measured outcomes, rather than assuming more AI or a larger plugin list improves results. Only public summaries were inspected here, not respondent-level data or an independent reanalysis. Forecast recommendations are conditional and should be revisited against actual customer tasks, not treated as causal research findings.
