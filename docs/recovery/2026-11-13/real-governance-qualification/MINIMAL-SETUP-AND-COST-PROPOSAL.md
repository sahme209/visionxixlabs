# Minimal real Governance test environment — proposal only

Owner chose preparation on November 13 after the existing console's us-east-2 ECS inventory showed zero clusters. No new account, cluster, service, task, role, credential, image repository, database, network or billing change is approved or created. Other regions are uninspected; this is not an account-wide absence claim.

## Recommendation

Use one temporary Linux/x86 Fargate **task**, rather than an always-running service, for the first isolated AWS qualification. Provisional sizing is 1 vCPU / 2 GiB, no more than 30 minutes including image pull, one task at a time, no retry. Size and exact regional price must be verified before a run. Do not create a NAT gateway, load balancer, Kubernetes cluster or paid database for this first unit. No public listener is proposed. Any public address is outbound-only with no inbound security-group rules; this does not itself establish credential isolation or adequate egress controls.

The task's initial purpose is qualifying the actual AWS credential source, exact artifact, private signing/send boundary and negative cases against a specifically disposable ECS target. A temporary task cannot stand in for the persistent authenticated GitHub-to-Axiom handoff, every product family, the Mac runtime, complete fleet closure or production readiness. Real application/schema/identity and human-approval prerequisites remain separate. Do not enable Governance based on this host existing.

## Zero-cost source/design prerequisites first

- Specify and independently review the actual Linux execution/profile adapter, immutable image/entrypoint, credential-source custody and final request-only API. The existing Mac XPC/Keychain package cannot simply run on Linux; this proposal does not replace or waive its original security contract.
- Bind the exact target account/region, reviewed image digest, task/workload identity, execution role and narrowly scoped disposable target. No role ARN, current trust policy or existing network is invented.
- Prove how the runner, developer shell, website and model cannot acquire the AWS target credential directly. Keep source and derived credential lifetimes accounted for, and demonstrate current drain/cutoff; a stopped task or expired local row alone is insufficient.
- Prepare full preflight/setup/test/verify/owned-cleanup manifests and required permission diffs. Use a separately isolated fixture database, not production Neon; select its safe placement and account for any residual lifetime before provisioning.
- Independently review the exact executable/run packet. Missing actual source/profile/custody evidence still refuses. No simulator or caller-supplied qualifier becomes a default.

## Initial budget illustration — actual Ohio follow-up recorded separately

Public AWS pages were read on November 13. The Fargate page's *published Northern Virginia Linux/x86 example*, not a verified Ohio regional quote, gives CPU $0.000011244/vCPU-second and RAM $0.000001235/GiB-second. For one 1-vCPU/2-GiB task lasting 1,800 seconds: compute = **$0.0246852**. Its default 20 GiB ephemeral storage needs no additional storage allocation. Pricing covers image pull through termination and has a 60-second Linux minimum. [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/).

One public IPv4, if required, is $0.005/hour: **$0.0025 for 30 minutes**. Avoid the Ohio NAT gateway example's $0.045/hour plus processing charges. [AWS VPC pricing](https://aws.amazon.com/vpc/pricing/).

Image storage must also be counted: the ECR example uses $0.10/GB-month; a provisional 5-GB image would cost **$0.50/month if retained**, or roughly $0.0167 for one day using a 30-day arithmetic approximation. Same-region ECR-to-Fargate transfer is listed as free; exact image size/retention remains unknown. [AWS ECR pricing](https://aws.amazon.com/ecr/pricing/).

Logs, outbound transfer, requests, retention, taxes and the separately scoped disposable target add charges. CloudWatch has usage allowances but they are shared and not assumed available. [AWS CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/).

The illustrated compute+address cost is about **$0.028**, before those extras. A **proposed $1 total trial allowance** is a review envelope, NOT a hard AWS billing cap and NOT yet authorized. Verify actual Ohio prices, image/fixture/resource sizes and a complete estimate before requesting the exact provisioning/run approval. The console's displayed credit balance does not authorize consumption or guarantee service eligibility; do not upgrade the plan or enable paid features.

## Acceptance and cost controls for a future reviewed run

Use fixed allowlisted resources, an independently enforced deadline and owner-scoped StopTask cleanup, deny automatic replacement/retry, retain nonsecret original receipts and verify task/credential closure. Cleanup must target only newly created resources whose ownership is proved; preserve every existing database, backup, history and unknown attempt. Unknown ownership or provider outcomes stop without speculative deletion or resend. Budgets/alarms may warn but are not assumed instantaneous hard caps.

Qualify one genuine independently reviewed disposable action only after the environment passes security checks, plus revocation, wrong scope/source, replay, concurrent claim and lost-result recovery. Preserve original attempts. Native provider effects and exact human decisions need the subsequent run's specific authorization. No ServiceNow note may be sent again.

## Decision after preparation

Review this architecture and close the named Linux custody, fixture placement and complete regional quote gaps before authorizing implementation/provisioning. Approval of this document alone would not authorize AWS account/IAM/service changes, credential acquisition, a test run, production database work, deployment, feature enablement or spending.


## November13 current follow-up

The actual rendered Ohio table has now been read and matches CPU$0.04048/vCPU-hour and memory$0.004445/GB-hour. FULL-TRIAL-COST-SUPPLEMENT.md includes the separate DB/target baseline and all outstanding cost exclusions; this worker-only arithmetic is not the complete end-to-end bill. No spending is approved.

Use the connected full-runtime design and same compiled consumer, not a standalone diagnostic image as a substitute. Any role-free protection observations belong inside that exact immutable runtime's qualification plan. Mac, live source/clock/custody, genuine human/provider and complete coverage requirements remain. This proposal authorizes no implementation, resource creation, native experiment or enablement.
