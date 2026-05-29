/**
 * Workspace id derivation — single source of truth.
 *
 * Until the User → Organization model lands, an organization id is a
 * stable hash of the user's email. Every caller MUST derive it the
 * same way, or writes from one path won't be read by another. The
 * original copy lived inside lib/auth/currentContext.ts (server-only),
 * but ConnectorSetupSession bridges in API routes also need it without
 * pulling the rest of the auth module in.
 *
 * Same email + same workspace id forever. Different emails → different
 * workspace ids → tenant isolation holds.
 */

import { createHash } from "node:crypto";
import { id } from "@/lib/domain/ids";
import type { OrganizationId } from "@/lib/domain/ids";

export function deriveWorkspaceIdFromEmail(email: string): OrganizationId {
  const hash = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
  return id.organization(`ws_${hash}`);
}
