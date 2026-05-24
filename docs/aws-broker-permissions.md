# AWS broker permissions

The platform's broker IAM user (the one whose access keys are stored
in `AWS_CONNECTOR_BROKER_ACCESS_KEY_ID` + `AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY`)
needs **one** combined inline policy. Paste this once and every future
customer connection works automatically — no per-customer setup.

## The policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeRoleIntoCustomerAccounts",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "*"
    },
    {
      "Sid": "ManageOwnQuickCreateTemplateBucket",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:HeadBucket"
      ],
      "Resource": "arn:aws:s3:::axiom-cfn-templates-*"
    },
    {
      "Sid": "ManageOwnQuickCreateTemplateObject",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:HeadObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::axiom-cfn-templates-*/axiom-agent-quick-deploy.yaml"
    }
  ]
}
```

## What each statement does

- **AssumeRoleIntoCustomerAccounts** — lets the broker call
  `sts:AssumeRole` against the read-only IAM role each customer's
  CloudFormation stack provisions. Without this, the bounce-back
  validation fails immediately even though the role exists.
- **ManageOwnQuickCreateTemplateBucket** — lets the platform create
  the deterministic bucket `axiom-cfn-templates-<broker-account-id>`
  the first time anyone hits `/api/aws/quick-deploy-url`. After that
  the bucket exists and these actions are no-ops.
- **ManageOwnQuickCreateTemplateObject** — lets the platform upload
  the CloudFormation YAML to that bucket and sign GET URLs for it.
  The bucket stays private; AWS Console fetches the template via a
  presigned URL signed by the broker.

## Override path (operator-managed bucket)

If you'd rather host the template yourself (different region, your
own CDN, etc.), set `AWS_CFN_TEMPLATE_S3_URL` to the full URL of
your hosted YAML and the auto-publisher will skip every S3 call.

The operator-managed URL must be an S3 URL — AWS Console's
CloudFormation Quick-Create deep-link rejects anything else.
