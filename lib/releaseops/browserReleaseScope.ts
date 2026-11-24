import type { CurrentContext } from "@/lib/auth/currentContext";

export function browserReleaseScope(context: CurrentContext) {
  if (!context.isAuthenticated || !context.sessionUserId || !context.organizationId || !context.roles.length) {
    return null;
  }
  return { userId: context.sessionUserId, organizationId: context.organizationId };
}
