/**
 * Practical AWS connection validator.
 *
 * Pure-shape validation runs first (cheap, deterministic). Live STS
 * AssumeRole + GetCallerIdentity validation runs only when:
 *   - the feature flag says live mode is allowed,
 *   - broker credentials are present in the host environment,
 *   - the user explicitly requested a live validation.
 *
 * When live mode is unavailable, the validator returns a typed "preview"
 * outcome rather than fabricating success. Never silently passes when the
 * STS call would have failed.
 */

import "server-only";
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { loadAppEnv } from "@/lib/config/env";
import {
  requireAwsRoleArn,
  requireAwsExternalId,
  requireAwsRegion,
} from "@/lib/security/validation";
import { isAxiomError } from "@/lib/errors/axiomErrors";
import type { AwsConnectionInput, AwsConnectionStatus } from "./awsConnection";

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type AwsValidationOutcome =
  | "valid_live"
  | "valid_format_only"
  | "invalid_format"
  | "access_denied"
  | "assume_role_failed"
  | "live_disabled";

export interface AwsValidationResult {
  ok: boolean;
  outcome: AwsValidationOutcome;
  status: AwsConnectionStatus;
  accountId?: string;
  validatedArn?: string;
  /** User-facing summary line. Always safe to render. */
  message: string;
  /** Stable error code for audit + UI switching. */
  errorCode?: string;
  /** Honest mode the validator actually ran in. */
  mode: "live" | "preview";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ValidateInput {
  input: AwsConnectionInput;
  /** Whether the caller is asking for a live STS round-trip. */
  requestLive: boolean;
}

export async function validateAwsConnection(opts: ValidateInput): Promise<AwsValidationResult> {
  // 1. Format validation — always
  try {
    requireAwsRoleArn(opts.input.roleArn);
    requireAwsExternalId(opts.input.externalId);
    requireAwsRegion(opts.input.region);
  } catch (err) {
    return {
      ok: false,
      outcome: "invalid_format",
      status: "validation_failed",
      message: isAxiomError(err) ? err.userMessage : "AWS input is malformed.",
      errorCode: isAxiomError(err) ? err.code : "validation.malformed",
      mode: "preview",
    };
  }

  const env = loadAppEnv();
  const canRunLive = env.awsScanMode === "live" && env.awsBrokerConfigured && opts.requestLive;

  // 2. Live STS round-trip — only when configured + requested
  if (canRunLive) {
    try {
      const broker = brokerClient(opts.input.region);
      const assumed = await broker.send(
        new AssumeRoleCommand({
          RoleArn: opts.input.roleArn,
          RoleSessionName: `axiom-validate-${Date.now()}`,
          ExternalId: opts.input.externalId,
          DurationSeconds: 900,
        }),
      );
      const creds = assumed.Credentials;
      if (!creds?.AccessKeyId || !creds?.SecretAccessKey || !creds?.SessionToken) {
        return failure("AssumeRole returned no credentials.", "aws.assume_role_empty", "assume_role_failed");
      }
      const tenantClient = new STSClient({
        region: opts.input.region,
        credentials: {
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          sessionToken: creds.SessionToken,
        },
      });
      const ident = await tenantClient.send(new GetCallerIdentityCommand({}));
      return {
        ok: true,
        outcome: "valid_live",
        status: "connected",
        accountId: ident.Account,
        validatedArn: ident.Arn,
        message: `Validated AWS account ${ident.Account} via assumed role.`,
        mode: "live",
      };
    } catch (err) {
      const code = errCode(err);
      if (code === "AccessDenied" || code === "AuthFailure") {
        return failure(
          "STS AssumeRole denied. Check that the broker principal is in the trust policy + External ID matches.",
          "aws.access_denied",
          "access_denied",
        );
      }
      return failure(
        `STS AssumeRole failed: ${errMessage(err)}`,
        "aws.assume_role_failed",
        "assume_role_failed",
      );
    }
  }

  // 3. Preview mode — format is correct, live mode wasn't run.
  return {
    ok: true,
    outcome: opts.requestLive ? "live_disabled" : "valid_format_only",
    status: "validating",
    message: opts.requestLive
      ? "AWS live mode is not configured on this deployment — input format validated only."
      : "Input format validated. Live STS validation will run when the scan is started.",
    mode: "preview",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function brokerClient(region: string): STSClient {
  const env = process.env;
  return new STSClient({
    region,
    credentials: {
      accessKeyId:     env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY!,
    },
  });
}

function failure(message: string, errorCode: string, outcome: AwsValidationOutcome): AwsValidationResult {
  return {
    ok: false,
    outcome,
    status: outcome === "access_denied" ? "permission_denied" : "validation_failed",
    message,
    errorCode,
    mode: "live",
  };
}

function errCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "name" in err) return String((err as { name?: string }).name);
  return undefined;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
