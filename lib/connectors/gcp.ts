/**
 * GCP connector — real Service Account validation via @google-cloud/resource-manager.
 * Multi-tenant safe: uses customer-provided service account JSON key.
 * Validates by authenticating and fetching project metadata.
 */

import { ProjectsClient } from "@google-cloud/resource-manager";
import type { ConnectorStatus } from "./types";
import { ENABLE_CLOUD_CONNECTORS_GCP } from "@/lib/featureFlags";

export type GCPServiceAccountInput = {
  projectId: string;
  serviceAccountJson: string;
};

export type ValidateGCPConnectionResult = {
  valid: boolean;
  status: ConnectorStatus;
  projectId?: string;
  projectName?: string;
  serviceAccountEmail?: string;
  errorCode?: string;
};

const PROJECT_ID_REGEX = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

function validateInput(input: GCPServiceAccountInput): string | null {
  if (!input.projectId?.trim()) return "Project ID is required";
  if (!PROJECT_ID_REGEX.test(input.projectId.trim())) return "Invalid Project ID format";
  if (!input.serviceAccountJson?.trim()) return "Service Account JSON is required";
  try {
    const parsed = JSON.parse(input.serviceAccountJson.trim());
    if (!parsed.client_email || !parsed.private_key) {
      return "Service Account JSON must contain client_email and private_key";
    }
    if (parsed.type !== "service_account") {
      return "JSON key type must be 'service_account'";
    }
  } catch {
    return "Invalid JSON format for Service Account key";
  }
  return null;
}

/**
 * Parse service account JSON and return credentials config for Google Cloud clients.
 */
export function parseServiceAccountCredentials(
  serviceAccountJson: string
): { credentials: { client_email: string; private_key: string }; projectId?: string } {
  const parsed = JSON.parse(serviceAccountJson.trim());
  return {
    credentials: {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    },
    projectId: parsed.project_id,
  };
}

/**
 * Validate GCP connection via Service Account authentication.
 * Authenticates and fetches project metadata to confirm access.
 */
export async function validateGCPConnection(
  input: GCPServiceAccountInput,
  _context?: { userId?: string; leadId?: string }
): Promise<ValidateGCPConnectionResult> {
  if (!ENABLE_CLOUD_CONNECTORS_GCP) {
    return { valid: false, status: "unavailable", errorCode: "FEATURE_DISABLED" };
  }

  const validationErr = validateInput(input);
  if (validationErr) {
    return { valid: false, status: "invalid", errorCode: "VALIDATION_FAILED" };
  }

  const projectId = input.projectId.trim();

  try {
    const saConfig = parseServiceAccountCredentials(input.serviceAccountJson);

    const projectsClient = new ProjectsClient({
      credentials: saConfig.credentials,
    });

    const [project] = await projectsClient.getProject({ name: `projects/${projectId}` });

    if (!project) {
      return { valid: false, status: "invalid", errorCode: "PROJECT_NOT_FOUND" };
    }

    return {
      valid: true,
      status: "linked",
      projectId: project.projectId ?? projectId,
      projectName: project.displayName ?? undefined,
      serviceAccountEmail: saConfig.credentials.client_email,
    };
  } catch (e) {
    const err = e as { code?: number; details?: string; message?: string };
    const code = err?.code != null ? `GCP_ERROR_${err.code}` : "UNKNOWN";
    return { valid: false, status: "invalid", errorCode: code };
  }
}
