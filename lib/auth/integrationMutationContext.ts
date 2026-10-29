import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "./currentContext";
import { isSameOriginRequest } from "./requestOrigin";
import { isTenantAdmin } from "./platformAdmin";
import { hasPermission } from "@/lib/axiom/agent/rbacEngine";
import type { OrgRole } from "@/lib/axiom/enums";

/** Legacy action/config routes must enforce the same workspace authority as the cockpit. */
export async function integrationMutationContext(request: NextRequest, action: "configure" | "dispatch" = "configure") {
  if (!isSameOriginRequest(request)) return { response: NextResponse.json({ ok: false, reason: "invalid_request_origin" }, { status: 403 }) };
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId || !context.sessionUserId || !context.email) {
    return { response: NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 }) };
  }
  const allowed = action === "configure" ? isTenantAdmin(context.roles)
    : context.roles.some(role => hasPermission(role as OrgRole, "actions:apply"));
  if (!allowed) return { response: NextResponse.json({ ok: false, reason: "forbidden_role" }, { status: 403 }) };
  return { context };
}
