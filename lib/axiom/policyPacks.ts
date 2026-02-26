/**
 * Phase 5: Enterprise Policy Packs — deterministic templates.
 * IAM, network segmentation, logging, incident response.
 * Enterprise: full templates; Pro/Growth: preview + upsell.
 */
export type PolicyPack = {
  iamTemplates: string[];
  networkSegmentation: string[];
  loggingMonitoring: string[];
  incidentResponse: string[];
};

export function generatePolicyPacks(): PolicyPack {
  return {
    iamTemplates: [
      "## IAM Policy Template (Least Privilege)\n\nReplace {{ACCOUNT_ID}}, {{ROLE_NAME}}, {{RESOURCE_ARN}} placeholders.\n\n```json\n{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"Allow\",\n      \"Action\": [\"s3:GetObject\", \"s3:ListBucket\"],\n      \"Resource\": [\"arn:aws:s3:::{{BUCKET_NAME}}/*\", \"arn:aws:s3:::{{BUCKET_NAME}}\"],\n      \"Condition\": {\n        \"StringEquals\": { \"aws:ResourceAccount\": \"{{ACCOUNT_ID}}\" }\n      }\n    }\n  ]\n}\n```",
      "Apply principle of least privilege; scope actions to specific resources; avoid wildcards in production.",
    ],
    networkSegmentation: [
      "## Network Segmentation Guidance\n\n- Place workloads in VPCs with private subnets where possible.\n- Use security groups to restrict traffic between tiers (web → app → data).\n- Enable VPC Flow Logs for audit and troubleshooting.\n- Replace {{VPC_CIDR}}, {{SUBNET_IDS}} with your values.",
    ],
    loggingMonitoring: [
      "## Logging & Monitoring Baseline\n\n- Centralize logs to CloudWatch Logs (or equivalent).\n- Set retention: {{RETENTION_DAYS}} days for audit logs, 30 days for app logs.\n- Enable metric filters for: failed auth, unusual API usage, resource creation.\n- Create alarms for: high error rate, latency p99 > threshold.",
    ],
    incidentResponse: [
      "## Incident Response Starter\n\n1. **Detection**: Alerts from monitoring baseline.\n2. **Triage**: Runbook for {{SERVICE_NAME}} — check health, recent deployments, logs.\n3. **Mitigation**: Rollback if deployment-related; scale or isolate if resource exhaustion.\n4. **Post-mortem**: Document timeline, root cause, and preventive actions.",
    ],
  };
}
