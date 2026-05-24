#!/usr/bin/env bash
# upload-cfn-template.sh — one-time setup the platform operator runs.
#
# Uploads public/aws/axiom-agent-quick-deploy.yaml to a public-read S3
# bucket so AWS Console's CloudFormation Quick-Create deep-link will
# accept it as a templateURL. (The AWS console rejects arbitrary HTTPS
# URLs — only S3 is supported. This is why we host the template here
# instead of serving it from visionxixlabs.com directly.)
#
# After this script succeeds, set the printed S3 URL as
# AWS_CFN_TEMPLATE_S3_URL on Vercel (or whatever host) and redeploy.
# The 1-click button on /operator/onboarding will become live for
# every customer.
#
# Usage:
#   ./scripts/upload-cfn-template.sh <bucket-name> [object-key]
#
# Example:
#   ./scripts/upload-cfn-template.sh visionxixlabs-public-cfn
#   ./scripts/upload-cfn-template.sh visionxixlabs-public-cfn axiom/agent-v1.yaml
#
# Requirements:
#   - aws cli configured with credentials that can s3:PutObject + s3:PutBucketPolicy
#   - The script creates the bucket if it doesn't exist + applies a
#     public-read policy scoped to ONLY the uploaded object key.
#
# Exit codes:
#   0  upload succeeded · prints the S3 URL on stdout
#   1  bad invocation
#   2  aws cli missing
#   3  upload / bucket-policy operation failed

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: ./scripts/upload-cfn-template.sh <bucket-name> [object-key]" >&2
  exit 1
fi

if ! command -v aws &> /dev/null; then
  echo "upload-cfn-template: aws cli not found on PATH." >&2
  exit 2
fi

BUCKET="$1"
OBJECT_KEY="${2:-axiom-agent-quick-deploy.yaml}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
LOCAL_FILE="${SCRIPT_DIR}/../public/aws/axiom-agent-quick-deploy.yaml"

if [[ ! -f "${LOCAL_FILE}" ]]; then
  echo "upload-cfn-template: ${LOCAL_FILE} not found." >&2
  exit 1
fi

echo "→ Checking bucket s3://${BUCKET}…"
if ! aws s3api head-bucket --bucket "${BUCKET}" 2> /dev/null; then
  echo "→ Bucket doesn't exist; creating in us-east-1…"
  aws s3api create-bucket --bucket "${BUCKET}" --region us-east-1 \
    || { echo "upload-cfn-template: failed to create bucket." >&2; exit 3; }
  aws s3api put-public-access-block --bucket "${BUCKET}" \
    --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
    || { echo "upload-cfn-template: failed to unblock public access." >&2; exit 3; }
fi

echo "→ Uploading ${LOCAL_FILE} to s3://${BUCKET}/${OBJECT_KEY}…"
aws s3 cp "${LOCAL_FILE}" "s3://${BUCKET}/${OBJECT_KEY}" \
  --content-type "application/x-yaml" \
  || { echo "upload-cfn-template: upload failed." >&2; exit 3; }

echo "→ Applying public-read bucket policy scoped to the object…"
POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObjectForAxiomAgentTemplate",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET}/${OBJECT_KEY}"
  }]
}
EOF
)
echo "${POLICY}" | aws s3api put-bucket-policy --bucket "${BUCKET}" --policy file:///dev/stdin \
  || { echo "upload-cfn-template: bucket policy apply failed." >&2; exit 3; }

S3_URL="https://${BUCKET}.s3.amazonaws.com/${OBJECT_KEY}"

cat <<EOF

✓ Upload complete.

Set this env var on Vercel (or your host) and redeploy:

  AWS_CFN_TEMPLATE_S3_URL=${S3_URL}

After redeploy, /operator/onboarding will show the 1-click button for
every customer. Test by opening it yourself — the AWS Console should
load CloudFormation's Quick-Create wizard with parameters pre-filled.

EOF
