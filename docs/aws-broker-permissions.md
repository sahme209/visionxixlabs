# AWS broker permissions

The platform's broker IAM user (the one whose access keys are stored
in `AWS_CONNECTOR_BROKER_ACCESS_KEY_ID` + `AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY`)
needs two permission sets:

## 1. AssumeRole into customer accounts

Standard cross-account scanner permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeRoleIntoCustomerAccounts",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "*"
    }
  ]
}
```

## 2. Self-publish the CloudFormation Quick-Create template to S3

Required for the 1-click button on `/operator/onboarding`. The
platform auto-creates a bucket named `axiom-cfn-templates-<broker-account-id>`
the first time a customer hits the endpoint, uploads
`public/aws/axiom-agent-quick-deploy.yaml` to it, and hands the
customer a *presigned* GET URL signed by the broker. The bucket
itself stays private — no public access, no bucket policy.

```json
{
  "Version": "2012-10-17",
  "Statement": [
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

After attaching this policy to the broker user, the platform's
`lib/cloud/aws/templateHosting.ts` will publish the template on the
first request to `/api/aws/quick-deploy-url` and cache the resulting
S3 URL in module memory for the function's lifetime.

## Override path (operator-managed bucket)

If you'd rather host the template yourself (different region, your
own CDN, etc.), set `AWS_CFN_TEMPLATE_S3_URL` to the full URL of
your hosted YAML and the auto-publisher will skip every S3 call.

The operator-managed URL must be an S3 URL — AWS Console's
CloudFormation Quick-Create deep-link rejects anything else.
