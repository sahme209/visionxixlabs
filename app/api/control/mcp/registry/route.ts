import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { fetchRegistryPage } from "@/lib/integrations/mcp/mcpRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });

/**
 * GET /api/control/mcp/registry?search=&cursor= — one page of the public MCP server registry for workspace
 * members to browse. Read-only and third-party data: nothing is installed, connected or granted.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.roles.length) return fail("workspace_membership_required", 403);
  const search = request.nextUrl.searchParams.get("search") ?? "";
  const cursor = request.nextUrl.searchParams.get("cursor");
  if (search.length > 100 || /[\u0000-\u001f]/.test(search) || (cursor && (cursor.length > 400 || /[\u0000-\u001f]/.test(cursor)))) return fail("invalid_query", 400);
  try {
    const page = await fetchRegistryPage({ search, cursor });
    return NextResponse.json({ ok: true, data: page }, { headers: noStore });
  } catch {
    return fail("registry_unavailable", 503);
  }
}
