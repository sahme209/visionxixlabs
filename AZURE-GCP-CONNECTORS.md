# Azure & GCP Connectors — Implementation Guide

## 1. AWS Connector Pattern (Reference)

### How Authentication Works

The AWS connector uses a **broker pattern** with STS AssumeRole:

1. **Your platform** has a "broker" AWS account with IAM credentials (`AWS_CONNECTOR_BROKER_ACCESS_KEY_ID`)
2. **Customers** create an IAM Role in their AWS account that trusts your broker
3. **On connect**: Broker calls `STS AssumeRole` with the customer's Role ARN → gets temporary credentials
4. **On validate**: Uses temp creds to call `GetCallerIdentity` → confirms access
5. **On plugin run**: Same flow — broker assumes role, gets 15min temp creds, passes to SDK clients

Key file: `lib/connectors/aws.ts`

### How Validation Works

```
validateAWSConnection(roleArn, awsAccountId)
  → validate input format (ARN regex, 12-digit account ID)
  → check feature flag (ENABLE_CLOUD_CONNECTORS_AWS)
  → getBrokerCredentialsForTenant() (never falls back to env for customer creds)
  → STS AssumeRole (broker → customer role)
  → STS GetCallerIdentity (verify assumed identity)
  → return { valid: true, status: "linked", account, arn }
```

### How Resources Are Fetched

The connector delegates to **execution plugins** via `executePlugin()`:
- `aws:infra-discovery` → EC2, S3, RDS, VPC counts
- `aws:iam-exposure-scan` → IAM audit findings
- `aws:s3-public-bucket-scan` → public bucket detection

Plugins resolve credentials via `getCredentialProvider().getAWSCredentials()` which reads encrypted creds from the Lead record and re-assumes the role for fresh temp creds.

---

## 2. Azure Connector Implementation

### Files Created/Modified

| File | What |
|---|---|
| `lib/connectors/azure.ts` | Real validation via `@azure/identity` Service Principal auth |
| `lib/connectors/azureConnector.ts` | CloudConnectorInterface implementation |
| `lib/plugins/azure/index.ts` | Plugin registration barrel |
| `lib/plugins/azure/infrastructure-discovery.ts` | VMs, Storage Accounts, Resource Groups |
| `lib/plugins/azure/security-scan.ts` | Storage public access, NSG open ports |
| `lib/plugins/credentials.ts` | Added `getAzureCredentials()` method |

### Authentication Flow

```
Customer provides: tenantId, clientId, clientSecret, subscriptionId
  → Validate UUID format for tenantId and clientId
  → Create ClientSecretCredential(tenantId, clientId, clientSecret)
  → SubscriptionClient.subscriptions.get(subscriptionId) to verify access
  → Store encrypted JSON { tenantId, clientId, clientSecret, subscriptionId }
```

Unlike AWS (broker pattern), Azure uses **direct Service Principal auth**. The customer creates an App Registration in Azure AD and provides the credentials. No broker needed because Azure AD handles multi-tenancy natively.

### Discovery Plugin: `azure:infra-discovery`

Fetches:
- Virtual Machines (all regions) via `ComputeManagementClient.virtualMachines.listAll()`
- Storage Accounts via `StorageManagementClient.storageAccounts.list()`
- Resource Groups via `ResourceManagementClient.resourceGroups.list()`

Returns: `{ vmCount, storageAccountCount, resourceGroupCount, services[], summary }`

### Security Scan Plugin: `azure:security-scan`

Checks:
- **Storage Accounts**: Public blob access enabled, HTTPS-only not enforced, TLS < 1.2
- **Network Security Groups**: Inbound rules allowing 0.0.0.0/0 on SSH (22), RDP (3389), or all ports

Returns: `{ findings[], summary, findingsCount }`

### Required npm Packages

```bash
npm install @azure/identity @azure/arm-subscriptions @azure/arm-compute @azure/arm-storage @azure/arm-resources @azure/arm-network
```

---

## 3. GCP Connector Implementation

### Files Created/Modified

| File | What |
|---|---|
| `lib/connectors/gcp.ts` | Real validation via Service Account JSON key |
| `lib/connectors/gcpConnector.ts` | CloudConnectorInterface implementation |
| `lib/plugins/gcp/index.ts` | Plugin registration barrel |
| `lib/plugins/gcp/infrastructure-discovery.ts` | Compute instances, Storage buckets |
| `lib/plugins/gcp/security-scan.ts` | Bucket IAM, Firewall rules |
| `lib/plugins/credentials.ts` | Added `getGCPCredentials()` method |

### Authentication Flow

```
Customer provides: projectId, serviceAccountJson (JSON key file contents)
  → Validate projectId format (lowercase, 6-30 chars)
  → Parse JSON key: must have type=service_account, client_email, private_key
  → ProjectsClient.getProject(projectId) to verify access
  → Store encrypted JSON { projectId, serviceAccountJson }
```

GCP uses **Service Account keys**. Customer creates a Service Account, downloads the JSON key, and pastes it into the connector form. The platform uses `credentials: { client_email, private_key }` for all SDK clients.

### Discovery Plugin: `gcp:infra-discovery`

Fetches:
- Compute Instances (all zones) via `InstancesClient.aggregatedList()`
- Storage Buckets via `Storage.getBuckets()`

Returns: `{ instanceCount, bucketCount, services[], summary, projectId }`

### Security Scan Plugin: `gcp:security-scan`

Checks:
- **Storage Buckets**: IAM bindings with `allUsers` (public) or `allAuthenticatedUsers`
- **Firewall Rules**: Ingress from 0.0.0.0/0 on SSH, RDP, or all ports

Returns: `{ findings[], summary, findingsCount }`

### Required npm Packages

```bash
npm install @google-cloud/resource-manager @google-cloud/compute @google-cloud/storage
```

---

## 4. Shared Interface

All three connectors implement `CloudConnectorInterface` from `lib/connectors/interface.ts`:

```typescript
interface CloudConnectorInterface {
  readonly provider: CloudProvider; // "aws" | "azure" | "gcp"
  
  validateConnection(
    input: Record<string, unknown>,
    context?: CloudConnectorContext
  ): Promise<ValidateConnectionResult>;
  
  discoverInfrastructure(
    context: CloudConnectorContext
  ): Promise<CloudOperationResult>;
  
  runSecurityScan(
    context: CloudConnectorContext
  ): Promise<CloudOperationResult>;
  
  applyFix(
    input: Record<string, unknown>,
    context: CloudConnectorContext
  ): Promise<CloudOperationResult>;
}
```

The registry (`lib/connectors/registry.ts`) maps providers to implementations:
- `getConnector("aws")` → AWSConnector
- `getConnector("azure")` → AzureConnector
- `getConnector("gcp")` → GCPConnector

The API route (`/api/connectors/link`) already handles Azure and GCP — it calls `getConnector(connectorType).validateConnection()` and stores encrypted credentials. No API route changes needed.

---

## 5. Plugin Integration

Each connector delegates operations to execution plugins:

| Connector | Discovery Plugin | Security Plugin |
|---|---|---|
| AWS | `aws:infra-discovery` | `aws:iam-exposure-scan` |
| Azure | `azure:infra-discovery` | `azure:security-scan` |
| GCP | `gcp:infra-discovery` | `gcp:security-scan` |

All plugins:
- Are registered via `registerExecutionPlugin()` in their respective `index.ts`
- Are read-only (`readOnly: true`, must run with `dryRun=true`)
- Resolve credentials via `getCredentialProvider().getXxxCredentials()`
- Return normalized `PluginResult` with `{ ok, data, error, summary }`

The connector imports (`import "@/lib/plugins/azure"`) ensure plugins are registered when the connector is loaded.

---

## 6. API Routes

The existing `/api/connectors/link` route already handles all three providers:

### POST /api/connectors/link (AWS)
```json
{
  "connectorType": "aws",
  "roleArn": "arn:aws:iam::123456789012:role/AxiomRole",
  "awsAccountId": "123456789012",
  "externalId": "optional-external-id"
}
```

### POST /api/connectors/link (Azure)
```json
{
  "connectorType": "azure",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "your-client-secret",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### POST /api/connectors/link (GCP)
```json
{
  "connectorType": "gcp",
  "projectId": "my-gcp-project-id",
  "serviceAccountJson": "{\"type\":\"service_account\",\"project_id\":\"...\",\"private_key\":\"...\",\"client_email\":\"...\"}"
}
```

All routes:
1. Validate token (starter token from cloud-operator session)
2. Check entitlements (Growth+ required for cloud connectors)
3. Check feature flag (`isCloudConnectorEnabled`)
4. Call `getConnector(type).validateConnection(input)` → real SDK validation
5. Encrypt credentials → store in lead.fullPayload.connectors[type]
6. Log audit trail

---

## 7. Credential Provider Updates

`lib/plugins/credentials.ts` now has three methods:

```typescript
interface CredentialProvider {
  getAWSCredentials(userId, credentialsKey?): Promise<AWSCredentials | null>;
  getAzureCredentials(userId, credentialsKey?): Promise<AzureCredentials | null>;
  getGCPCredentials(userId, credentialsKey?): Promise<GCPCredentials | null>;
}
```

Each method:
1. Looks up Lead by `credentialsKey` (leadId)
2. Reads `fullPayload.connectors[provider].encryptedCredRef`
3. Decrypts with `decryptCredential()`
4. Returns typed credentials for the respective SDK

---

## 8. Environment Variables

Add to `.env`:

```bash
# Azure connector
ENABLE_CLOUD_CONNECTORS_AZURE=true

# GCP connector
ENABLE_CLOUD_CONNECTORS_GCP=true
```

No broker credentials needed for Azure/GCP — they use direct customer credentials (Service Principal / Service Account), unlike AWS which uses a broker assume-role pattern.

---

## 9. Install Dependencies

```bash
# Azure SDKs
npm install @azure/identity @azure/arm-subscriptions @azure/arm-compute @azure/arm-storage @azure/arm-resources @azure/arm-network

# GCP SDKs
npm install @google-cloud/resource-manager @google-cloud/compute @google-cloud/storage
```

---

## 10. Files Changed Summary

### New Files
- `lib/plugins/azure/index.ts`
- `lib/plugins/azure/infrastructure-discovery.ts`
- `lib/plugins/azure/security-scan.ts`
- `lib/plugins/gcp/index.ts`
- `lib/plugins/gcp/infrastructure-discovery.ts`
- `lib/plugins/gcp/security-scan.ts`

### Modified Files
- `lib/connectors/azure.ts` — stub → real Service Principal validation
- `lib/connectors/gcp.ts` — stub → real Service Account validation
- `lib/connectors/azureConnector.ts` — stub → real CloudConnectorInterface impl
- `lib/connectors/gcpConnector.ts` — stub → real CloudConnectorInterface impl
- `lib/plugins/credentials.ts` — added getAzureCredentials() and getGCPCredentials()
- `lib/execution/pluginEngine.ts` — added cloud:azure and cloud:gcp to user scopes

### Unchanged (Already Working)
- `lib/connectors/interface.ts` — CloudConnectorInterface (no changes needed)
- `lib/connectors/registry.ts` — already maps azure/gcp to connectors
- `app/api/connectors/link/route.ts` — already handles azure/gcp input
- `app/api/connectors/status/route.ts` — already returns connector metadata
- `lib/featureFlags.ts` — already has ENABLE_CLOUD_CONNECTORS_AZURE/GCP flags
