import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveRequestDesktopSession } from './resolveRequestDesktopSession';
import { createOutlookRuntime, outlookConfigured } from '@/lib/integrations/outlook/outlookRuntime';
import { outlookReadSchema, outlookReadTargetSchema, outlookStatusSchema } from './outlookContract';
import type { ConnectedActionScope } from '@/lib/integrations/connectedActionContract';

const principal = z.object({
  id: z.string().min(1), organizationId: z.string().min(1),
  userId: z.string().min(1), credentialKind: z.literal('desktop_session'),
}).passthrough();
const date = z.string().datetime();
const readQuery = z.union([
  z.object({ start: date, end: date }).strict(),
  outlookReadTargetSchema.extend({ start: date, end: date }),
]).refine(({ start, end }) => Date.parse(end) > Date.parse(start) && Date.parse(end) - Date.parse(start) <= 31 * 86400000);
const readFields = new Set(['start', 'end', 'connectionId', 'connectionRevision']);
const safeFailures = new Set([
  'outlook_mailbox_owner_required', 'outlook_refresh_required', 'outlook_connection_required',
  'outlook_connection_changed', 'outlook_permissions_required', 'outlook_authorization_required',
  'outlook_mailbox_unavailable', 'outlook_credential_unavailable',
]);
const production = {
  resolve: (request: NextRequest) => resolveRequestDesktopSession(request, {
    requiredScope: 'pipeline:read', requiredCapability: 'workspace:read',
    requireWorkspaceMembership: true, allowApiKey: false, route: 'Outlook owner-only reads',
  }),
  configured: outlookConfigured,
  runtime: createOutlookRuntime,
};
export interface OutlookDesktopHttpPorts {
  resolve: (request: NextRequest) => Promise<unknown>;
  configured: () => boolean;
  runtime: (assertCurrent: (scope: Readonly<ConnectedActionScope>, signal: AbortSignal) => Promise<void>) =>
    Pick<ReturnType<typeof createOutlookRuntime>, 'status' | 'read'>;
}

export function createOutlookDesktopHttp(ports: OutlookDesktopHttpPorts = production) {
  return async (request: NextRequest) => {
    const send = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    try {
      if (request.method !== 'GET') return send({ ok: false, error: 'method_not_allowed' }, 405);
      const query = request.nextUrl.searchParams;
      if (![0, 2, 4].includes(query.size) || [...query.keys()].some(key => !readFields.has(key) || query.getAll(key).length !== 1)) {
        return send({ ok: false, error: 'invalid_outlook_request' }, 400);
      }
      const parsed = principal.safeParse(await ports.resolve(request));
      if (!parsed.success) return send({ ok: false, error: 'desktop_session_required' }, 401);
      const session = parsed.data;
      const scope: ConnectedActionScope = { organizationId: session.organizationId, actorUserId: session.userId, sessionId: session.id };
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25000)]);
      async function assertCurrent(expected: Readonly<ConnectedActionScope>, abort: AbortSignal) {
        abort.throwIfAborted();
        const fresh = principal.safeParse(await ports.resolve(request));
        if (!fresh.success || fresh.data.id !== expected.sessionId || fresh.data.organizationId !== expected.organizationId || fresh.data.userId !== expected.actorUserId) {
          throw Error('outlook_authorization_required');
        }
        abort.throwIfAborted();
      }
      if (!ports.configured()) return send({ ok: true, data: { state: 'not_configured' } });
      const runtime = ports.runtime(assertCurrent);
      if (!query.size) {
        const data = outlookStatusSchema.parse(await runtime.status(scope, signal));
        await assertCurrent(scope, signal);
        return send({ ok: true, data });
      }
      const read = readQuery.parse(Object.fromEntries(query));
      const range = { start: read.start, end: read.end };
      // Previously shipped readers omit the two target fields.
      const target = 'connectionId' in read ? { connectionId: read.connectionId, connectionRevision: read.connectionRevision } : undefined;
      const data = outlookReadSchema.parse(await runtime.read(scope, range, signal, target));
      await assertCurrent(scope, signal);
      return send({ ok: true, data });
    } catch (error) {
      const code = error instanceof Error && safeFailures.has(error.message) ? error.message : 'outlook_read_unavailable';
      return send({ ok: false, error: code }, 409);
    }
  };
}
