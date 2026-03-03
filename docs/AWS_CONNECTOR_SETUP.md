# AWS Connector Setup (AssumeRole)

The Axiom AWS connector uses **STS AssumeRole** + **GetCallerIdentity** validation. No long-term access keys are stored. Multi-tenant safe.

## Prerequisites

1. **Vision XIX broker account** — AWS credentials for the Vision XIX service account (used to assume into customer roles).
2. **Customer IAM role** — In the customer's AWS account, a role that trusts the Vision XIX broker account.

## Customer Setup

### 1. Create IAM Role

Create an IAM role in your AWS account with a trust policy that allows the Vision XIX broker account to assume it.

**Trust policy** (replace `BROKER_ACCOUNT_ID` with Vision XIX's AWS account ID):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::BROKER_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "YOUR_EXTERNAL_ID"
        }
      }
    }
  ]
}
```

- **External ID** (optional but recommended for enterprise): A shared secret you provide when linking. Prevents confused deputy. Omit the `Condition` block if not using external ID.
- **Permissions**: Attach policies that grant read-only access (e.g. IAM read, Cost Explorer read, EC2 describe). Vision XIX only performs read-only analysis.

### 2. Link in Axiom

When linking AWS in the Connectors tab, provide:

| Field | Required | Description |
|-------|----------|-------------|
| `roleArn` | Yes* | Full ARN: `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME` |
| `awsAccountId` | Yes | Your 12-digit AWS account ID (must match the role's account). |
| `roleName` + `awsAccountId` | Yes* | Alternative to roleArn — we construct `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`. |
| `externalId` | No | Required if your trust policy uses `sts:ExternalId`. |
| `region` | No | STS region (default `us-east-1`). Kept for future service calls. |

*Provide either `roleArn` or both `roleName` and `awsAccountId`.

### 3. API Example

```bash
POST /api/connectors/link?token=YOUR_TOKEN
Content-Type: application/json

{
  "connectorType": "aws",
  "roleArn": "arn:aws:iam::123456789012:role/AxiomReadOnlyRole",
  "awsAccountId": "123456789012",
  "externalId": "your-external-id"
}
```

## Environment (Vision XIX Deployment)

| Variable | Purpose |
|----------|---------|
| `ENABLE_CLOUD_CONNECTORS_AWS` | `true` to enable AWS connector. |
| `AWS_CONNECTOR_BROKER_ACCESS_KEY_ID` | Broker IAM user access key (or `AWS_ACCESS_KEY_ID`). |
| `AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY` | Broker IAM user secret (or `AWS_SECRET_ACCESS_KEY`). |
| `AWS_CONNECTOR_BROKER_REGION` | Optional; defaults to `us-east-1` or `AWS_REGION`. |

The broker IAM user/role must have `sts:AssumeRole` permission for customer role ARNs (or use a wildcard trust). The broker should **not** have broad permissions in the broker account — it only needs to assume customer roles.
