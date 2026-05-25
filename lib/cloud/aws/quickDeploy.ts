/**
 * One-click CloudFormation deploy URL builder — Phase 411.
 *
 * Pure function. Given a session externalId, returns the AWS Console
 * URL that opens CloudFormation's Quick-Create wizard with our template
 * + the externalId parameter pre-filled. The customer clicks once,
 * AWS creates the role, the customer copies the Role ARN back into
 * our form.
 *
 * No JSON copy-paste, no AWS wizard navigation, no manual policy
 * attachment.
 */

const TEMPLATE_PATH = "/aws/axiom-agent-quick-deploy.yaml";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_STACK_NAME = "axiom-agent";

export interface QuickDeployUrlInput {
  /** Session-specific externalId minted on /operator/onboarding. */
  externalId: string;
  /** Site origin that hosts the CloudFormation template (must be public-readable). */
  origin: string;
  /** AWS region the customer wants the stack to live in. Defaults to us-east-1. */
  region?: string;
  /** Name to give the CloudFormation stack. Defaults to "axiom-agent". */
  stackName?: string;
  /**
   * AWS account id of the platform's broker IAM user. Injected into the
   * CFN URL as `param_BrokerAccountId` so the role's trust policy is
   * scoped to the actual broker. Skipping this lets the YAML template
   * fall back to its baked-in default — which has historically been
   * wrong and caused silent AssumeRole-denied loops. Always pass this
   * in production; the parameter is only optional for unit tests.
   */
  brokerAccountId?: string;
}

/**
 * Build the AWS console URL that opens CloudFormation's Quick-Create
 * wizard pre-filled with our template + externalId.
 *
 * Example output:
 *   https://us-east-1.console.aws.amazon.com/cloudformation/home?
 *     region=us-east-1#/stacks/quickcreate?
 *     templateURL=https://visionxixlabs.com/aws/axiom-agent-quick-deploy.yaml&
 *     stackName=axiom-agent&
 *     param_ExternalId=axiom-abc123
 */
export function buildAwsQuickDeployUrl(input: QuickDeployUrlInput): string {
  if (!isValidExternalId(input.externalId)) {
    throw new Error(`Invalid externalId for quick-deploy: ${input.externalId}`);
  }
  const origin = input.origin.replace(/\/$/, "");
  const region = input.region ?? DEFAULT_REGION;
  const stackName = input.stackName ?? DEFAULT_STACK_NAME;
  const templateUrl = `${origin}${TEMPLATE_PATH}`;
  const params = new URLSearchParams();
  params.set("templateURL", templateUrl);
  params.set("stackName", stackName);
  params.set("param_ExternalId", input.externalId);
  if (input.brokerAccountId) {
    if (!/^[0-9]{12}$/.test(input.brokerAccountId)) {
      throw new Error(`Invalid brokerAccountId for quick-deploy: ${input.brokerAccountId}`);
    }
    params.set("param_BrokerAccountId", input.brokerAccountId);
  }
  return `https://${region}.console.aws.amazon.com/cloudformation/home?region=${encodeURIComponent(region)}#/stacks/quickcreate?${params.toString()}`;
}

/**
 * Same validation the CloudFormation template's AllowedPattern enforces
 * so callers can fail fast in JS-land before sending the customer to
 * AWS and having CloudFormation reject the parameter.
 */
export function isValidExternalId(s: string): boolean {
  return /^axiom-[a-zA-Z0-9]{8,32}$/.test(s);
}
