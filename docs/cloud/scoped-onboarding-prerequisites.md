# Scoped AWS and Azure read-only onboarding

The setup status reports local service prerequisites only. `providerValidation: not_checked` is invariant. Available vault encryption and configured broker names do not establish valid credentials, current provider access, usable storage tables, subscription state, IAM/RBAC permissions, inventory completeness, or deployment authority. Existing enrollment performs those separate checks. The status endpoint never reads a saved cloud credential or contacts a provider; its vault test encrypts/decrypts a fixed synthetic string locally and discards the ciphertext.

## Existing evidence and administrator decisions

Historical AWS evidence identifies account `895544788479`, role `AccountFullAccessRole`, and readable ECS/CloudFormation collections in `us-east-2`. It records 49 denied regional calls out of 52, including managed Airflow denied in every inspected region. These are historical observations, not a current grant or proof that the current EC2 enrollment read is permitted. Do not repeat the regional denial sweep or substitute broader administrator access.

No Azure tenant ID, subscription ID, client ID or active subscription is established by the available account receipts. A personal Microsoft sign-in and subscription offers do not establish them. The administrator must identify an existing intended tenant and active subscription, its owner, and an existing approved service principal. Do not create a subscription, register an application, create a secret, or assign a role as an incidental setup step.

## AWS: Axiom service broker and an existing target role

1. The Axiom service operator must confirm an existing approved broker configuration: `AWS_CONNECTOR_BROKER_ACCESS_KEY_ID` and `AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY`, effective `AWS_SCAN_MODE=live`, and `ENABLE_CLOUD_CONNECTORS_AWS` not equal to `false`. The setup DTO exposes only presence/mode, never values or broker identity. Current broker code accepts a key pair, not an ambient workload identity or plugin credential; temporary broker credentials/session tokens and workload identity require a separate implementation review.
2. The account administrator must identify the exact existing target role ARN, account and region. Broker permission to assume that role and the role's trust policy are distinct. Trust must restrict the approved broker principal and require the current server-generated external ID. Axiom's ten-minute challenge is one-use; no caller-supplied external ID overrides its stored binding. Do not broaden trust or create another role without explicit authorization.
3. Current enrollment verifies the assumed account/role identity with STS; optional inventory reads one EC2 `DescribeInstances` page with `MaxResults=5` in the stored region. Review precisely that read against effective SCP, identity policy, session and trust restrictions. Historical ECS access does not prove EC2 access. No deployment, role passing, EC2 creation, MWAA access or workflow dispatch belongs in this read setup.
4. Successful enrollment persists a disabled `observe_only` tenant connection. Generic Agent scans remain unavailable. Inventory has `complete:false`; denial means unknown inventory, not an empty account.

The connected AWS tool is a separate interactive connection. Its latest documentation-only call required reauthentication; reconnecting it cannot repair an SCP denial or configure Axiom's service broker. No denied AWS API needs to be retried until the administrator has resolved the actual permitted scope.

For a later authorized baseline IAM policy generation from the runtime TypeScript, use the AWS IAM skill's static-analysis workflow rather than a hand-written broad policy. This command is a proposal only: `uvx` is not currently available in the inspected shell; running it can download software. Do not run/install/upload/apply it under this documentation task.

```sh
uvx iam-policy-autopilot@latest generate-policies \
  /Users/samirahmed/Documents/Codex/2026-10-22/referenced-chatgpt-conversation-this-is-an/work/axiom-cockpit/lib/cloud/aws/enrollment/stsValidation.ts \
  --region us-east-2 --account 895544788479 --service-hints sts ec2 --pretty
```

That file also contains inactive observation entrypoints; generated output needs administrator review and narrowing to the intended enrollment slice. It cannot establish or change effective SCP/trust policy.

## Azure: tenant vault and an existing service principal

1. Axiom needs a working scoped vault (`CREDENTIAL_ENCRYPTION_KEY`, or the existing supported `STARTER_TOKEN_SECRET` fallback, at least 32 characters). The status checks the actual local primitive, not merely a variable name. Do not rotate or create keys as a setup side effect; changing the key can make existing ciphertext unreadable.
2. Scoped enrollment accepts `tenantId`, `subscriptionId`, `clientId`, existing `clientSecret`, and exact connection `expectedVersion`. These are sent only through the existing approved enrollment flow and stored in the context-encrypted tenant/version vault after validation. Never paste a secret into source, a chat, a screenshot or a report. This flow does not require ambient `AZURE_*` configuration or `AZURE_SCAN_MODE`; those belong to separate legacy scanners.
3. The current implementation requests a token for ARM, reads `/subscriptions/{subscriptionId}`, checks exact tenant/subscription identity, then optionally lists the first 100 resource groups at subscription scope. An administrator must review subscription metadata and resource-group read access. A custom role limited to `Microsoft.Resources/subscriptions/read` and `Microsoft.Resources/subscriptions/resourceGroups/read` at that subscription is a candidate for this narrow contract; built-in subscription Reader covers it more broadly. Resource-group-only Reader does not authorize the current subscription-wide contract. Owner, Contributor, Graph permissions, data-plane access and writes are not required by these code paths.
4. If the permitted scope is one resource group only, implement and review an explicit resource-group-bound enrollment/inventory contract first; do not silently broaden the principal's role or advertise the current list as resource-group-scoped.
5. Successful connection records identity validation, leaves `enabled:false` and `agentScanAvailable:false`, and does not establish current inventory health. Disconnect clears Axiom's saved configuration; it does not revoke Entra grants or already issued tokens.

There is no Azure account-management connector exposed in this tool session. Guidance or SDK documentation cannot establish live tenant/subscription access.

## Storage, limits and acceptance

The October 23 storage recovery receipt records the additive cloud-enrollment tables applied with zero account, credential and attempt rows. This is historical storage evidence; the readiness endpoint does not re-query or certify current database compatibility, migration-history convergence, workspace allowance or commercial access. Enrollment retains its accepted-membership, session, commercial, plan, storage and atomic version checks. No readiness status enables a new control or weakens those checks.

After human/admin facts and any separately approved configuration are settled, acceptance should explicitly distinguish local prerequisites, exact cloud identity validation, bounded inventory permission, local connection persistence/revocation and native UI behavior. Avoid another broad discovery sweep. Each live validation or configuration change remains a separately authorized action.

References: [AWS third-party role/external ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html), [AWS SCP semantics](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html), [Microsoft Reader](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/general#reader), [Microsoft application/service principal setup](https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal).
