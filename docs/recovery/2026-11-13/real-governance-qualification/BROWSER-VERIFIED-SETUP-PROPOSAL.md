# Real Governance evaluation — account-grounded setup proposal

Status: design/cost preparation only. The owner approved the read-only console inspection and preparation of a minimal setup/cost proposal, not creation, IAM, credentials, native execution, installation, spending or enablement. Current source checkpoint is PR330/ece70e38. See aws-readonly-preflight/CONSOLE-SIGNED-IN-RESULT.json for sanitized live observations. Raw account/network identifiers remain private tool context; an eventual approved execution packet must bind actual targets before mutation.

## Observed foundation and proposed use

The expected test account in us-east-2 has zero ECS clusters, one Available default VPC, three Available public/default subnets across three availability zones, and one main route table with active local and Internet Gateway default routes. The subnets automatically assign public IPv4. The default security group allows all traffic from itself and all outbound IPv4. These are topology facts, not a vulnerability finding or native isolation qualification.

Reuse existing VPC/subnet/route infrastructure unchanged only if the final native network/profile review accepts it. Create a dedicated evaluation cluster and dedicated security groups; never attach the default group. Do not create a NAT gateway, load balancer, managed database or additional observer/registry/log service implicitly. Public routing does not make a task private. Image/bootstrap/provider reachability and every address, endpoint or service must be explicit and priced.

## Minimum resource and network design

| Proposed new resource | Fixed purpose and restriction |
| --- | --- |
| One dedicated ECS evaluation cluster | Newly owned evaluation resources only; no existing customer workload |
| One EC2 host and root disk | Closed trusted initializer, ECS agent, protected time daemon and fixed executor only; no SSH, ECS Exec, arbitrary agent code or unrelated task |
| One fixed EC2-capacity executor task | Exact immutable image/entrypoint/configuration and private initializer; ECS task credential source retained, never direct host IMDS fallback |
| One separate role-free Fargate PostgreSQL fixture task | Synthetic data only; no production Neon or provider task role; provisioning/admin identity separate from restricted runtime |
| One separate role-free Fargate target service | Healthy baseline and only the separately reviewed replacement; no public application ingress, provider task role or automatic rollback |
| Four dedicated security groups | Host, executor, database and target; no inherited default/self-ingress rules |

Initial role-free qualification proposes no inbound rules on host, executor or target. Database ingress is TCP5432 from the executor security group only. No other component receives database access. Replace unrestricted default egress with the exact necessary bootstrap/image/DNS/time/provider paths after those paths are established. TCP443 alone does not enforce hostname isolation; any proxy or endpoint is a separate resource/cost/security decision. The host cannot silently receive a broad instance role, and a role-free Fargate task cannot silently receive a credential-bearing execution role for registry/log/secrets access.

This initial no-ingress layout does NOT yet support the later genuine desktop requester/reviewer workflow. The authenticated TLS/private-handler ingress and separately authenticated external observer must be specified before that phase. No public listener, reverse tunnel or extra host is authorized or implied. Security groups alone do not prove task credential-endpoint/host-metadata isolation; real process/namespace/ECS-agent controls and negative tests remain required.

## Supported arithmetic, not a final quote

Saved November13 Ohio rates: m6i.large $0.096/hour; Fargate $0.04048/vCPU-hour and $0.004445/GiB-hour; public IPv4 $0.005/address-hour; gp3 $0.08/GB-month with a stated720-hour arithmetic month. Rates and original evidence are in design/EC2-BOUNDED-FOLLOWUP-RESULT.md and FULL-TRIAL-COST-SUPPLEMENT.md. The host type,20GB disk and small task sizes are illustrative, not qualified selections or current account offers.

| Explicit illustrative lifetime | Cost USD |
| --- | ---: |
| EC2 host:30-minute common trial | 0.0480000000 |
| Fixture+baseline target: each0.25vCPU/0.5GiB for30minutes | 0.0123425000 |
| Three IPv4 addresses for that30-minute window | 0.0075000000 |
| 20GB gp3 retained only30minutes | 0.0011111111 |
| Enumerated simultaneous-window subtotal | 0.0689536111 |
| Separate host bootstrap30minutes, including its IPv4 | 0.0505000000 |
| Additional small replacement30minutes, including its IPv4 | 0.0086712500 |
| Additional20GB disk30minutes for60-minute total lifetime | 0.0011111111 |
| Combined illustrative subtotal BEFORE unpriced items | 0.1292359722 |

Disk retention alone is about$0.0533333333 for20GB/24hours or$1.60/30days, independent of host shutdown. These examples are not a complete cost, approved allowance, spending request or hard billing cap. No free credits or shared free allowances are assumed.

Before a final numeric quote, fix OS/AMI/architecture and disk minimum; exact image sizes/pull/build/observer placement; baseline/replacement sizes and overlap; registry/log/transfer/request volumes; evidence/disk/address retention; cleanup-delay exposure; taxes and contingency. Price each selected additional service or prove it absent. Existing public ECR example pricing is not a qualified final registry selection. Budget alarms/timers are not native billing caps; unknown cleanup cannot be declared complete or financed by deleting existing evidence/backups.

## Finite critical path before provisioning

1. Resolve the exact native reader ABI/writer/daemon and conservative time-sampling premises from saved evidence first. The four-file source audit is complete and consumed; do not repeat it or search releases again. The accepted boundary is original authorization at commit plus the SAME one-use deadline/native-currentness checkpoint, retaining the provider scheduling race.
2. Freeze and independently review one local bridge/private Linux composition plan. Native-time implementation is not yet approved; source/contract design is authorized, while actual code/native extraction, compilation/clock/runtime/security operations need their applicable scoped decision.
3. Bind exact artifact/OS/image/agent/runtime, private resource delivery, observer and genuine client ingress. Separate role-free native qualification from later credential and provider phases.
4. Finish full numeric quote and exact new-resource/IAM/network before/after manifests with finite lifetimes, owned stop/retention/cleanup and residual exposure. No resource creation or spend request is ready until these are concrete.
5. After explicit decisions: role-free runtime/time/isolation tests; actual custody/renewal-cutoff and lifetime evidence; genuine independent requester/reviewer flow; one exact disposable deployment/readback; retained original unknown liabilities and verified owned cleanup. Unknown never retries or silently rolls back.

This trial does not complete all Governance or the master plan. Other action families, native desktop/installers, independent security, production compatibility, ServiceNow genuine approval/closure and all owner gates remain. Existing successful ordinary/230SQL/build checks do not need repeating on unchanged runtime source.
