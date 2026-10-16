# Agent ECS restart target approval binding

The legacy `trigger_aws_deploy` tool restarts an existing ECS service task definition. It does not build, deploy, or promote the selected source artifact. The pure ECS v2 contract remains a separate, unconnected implementation slice.

## Fixed customer/security boundary

Previously, a pending Agent proposal bound an environment ID but not its actual AWS deployment target. Reconfiguring that environment before approval caused the old proposal to dispatch a different role, region, cluster, or service without presenting that target to its reviewer.

The proposal preparation boundary now discards all caller/model `_review` data and reads the tenant-owned environment and target. It records the actual environment ID/tier, target ID/provider/updatedAt revision, role ARN, region, cluster, and service under `ecs_restart_target`. The existing canonical proposal digest covers this server-owned evidence. Browser governance and desktop approval cards display the target and restart limitation before approval.

Execution refuses absent/historical or changed target evidence; it never creates a fresh binding for an old approval. The target is checked before GitHub policy/token work and again after policy/quota reservation IO immediately before dispatch. Dispatch arguments come from the reviewed snapshot. A confirmed pre-dispatch mismatch releases the newly claimed reservation; read failures fail closed. Tenant membership, separate approver, approval expiry, Agent tool allowlist, production policy, GitHub scope, and quota guards remain intact. Proposals lacking target review require a new proposal and independent approval.

## Evidence and limits

Regression tests prove historical proposals and changed role/region/cluster/service/tenant/tier/target identity/revision cannot dispatch, including reconfiguration during reservation IO. Ten such tests dispatch incorrectly against the previous executor. Tests also prove caller review replacement and actual browser/desktop target rendering. All provider operations are mocked.

`DeploymentTarget.updatedAt` is the existing configuration revision. There is no associated cloud credential connection foreign key/version in this schema; this change does not invent one or attest IAM trust, STS identity, workflow contents, cloud ownership, application health, or image recovery. Target configuration read/recheck and GitHub dispatch are not an atomic distributed transaction. A change after the final read remains a race requiring the durable operation/target concurrency mechanism in the ECS v2 plan. Snapshot arguments prevent the reconfigured target from replacing the approved dispatch arguments, but do not prove continued authority after that read. Source branch movement and immutable artifact binding are also separate v2 prerequisites. No production deployment or real provider acceptance is claimed.

Next: integrate durable source/artifact/target reservations and receipts under the reviewed ECS v2 plan, then perform separately authorized sandbox rollout, health, and recovery acceptance. No schema or production change is part of this patch.
