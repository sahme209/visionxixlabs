import { NextResponse, type NextRequest } from 'next/server';
import { currentContext } from '@/lib/auth/currentContext';
import { prisma } from '@/lib/db';
import { readUsageRecords, usageCsv } from '@/lib/cockpit/usageRecords';
import { hasDesktopCapability, type DesktopWorkspaceRole } from '@/lib/desktop/desktopAuthorization';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const roles: readonly string[] = ['owner', 'admin', 'operator', 'security_reviewer', 'finance_viewer', 'read_only'];
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
/** Uses the same workspace ledger as account usage. Does not disclose actor
 * identifiers, provider costs, prompts or metadata; makes no billing writes. */
export async function GET(request: NextRequest) {
  try {
    const context = await currentContext();
    if (!context.isAuthenticated || !context.userId || !context.organizationId) return reply({ ok: false, error: 'sign_in_required' }, 401);
    const role = context.roles.find(value => roles.includes(value)) as DesktopWorkspaceRole | undefined;
    if (!hasDesktopCapability(role, 'workspace:read')) return reply({ ok: false, error: 'workspace_membership_required' }, 403);
    const format = request.nextUrl.searchParams.get('format');
    if (format !== null && format !== 'csv') return reply({ ok: false, error: 'usage_filter_invalid' }, 400);
    const page = await readUsageRecords(prisma, String(context.organizationId), request.nextUrl.searchParams);
    if (format === 'csv') return new Response(usageCsv(page), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="axiom-usage-${page.month}-page-${page.offset / 50 + 1}.csv"`, 'X-Content-Type-Options': 'nosniff' } });
    return reply({ ok: true, data: page });
  } catch (error) {
    if (error instanceof Error && error.message === 'usage_filter_invalid') return reply({ ok: false, error: 'usage_filter_invalid' }, 400);
    return reply({ ok: false, error: 'usage_records_unavailable' }, 503);
  }
}
