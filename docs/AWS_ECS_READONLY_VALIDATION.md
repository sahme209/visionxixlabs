# ECS read-only validation

Use the **Axiom AWS ECS Read-Only Validation** workflow before any separately
approved deploy workflow. It uses GitHub OIDC and performs only STS and ECS
`Describe*` calls; it contains no `update-service`, task-definition register,
or deployment trigger.

Dispatch it only with a non-production account and provide the expected account
ID explicitly. The job fails if the assumed role resolves to another account,
if the service is missing or inactive, or if its task definition cannot be
read. Its summary records only non-secret identity and service evidence.

Required dispatch values are the OIDC role ARN, region, expected non-production
account ID, cluster, and service. A successful run confirms only read access
and service visibility. It is not authorization to deploy, restart, merge, or
modify the service.
