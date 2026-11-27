/**
 * Founder gate for the private operations console. Deny by default: only a signed-in account whose
 * email is in ADMIN_EMAILS passes. Every founder page and route calls this on every request.
 */
import "server-only";
import { currentContext } from "@/lib/auth/currentContext";
import { isPlatformAdmin } from "@/lib/auth/platformAdmin";

export async function founderContext(): Promise<{ email: string } | null> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.email) return null;
  return isPlatformAdmin(c.email) ? { email: c.email.trim().toLowerCase() } : null;
}
