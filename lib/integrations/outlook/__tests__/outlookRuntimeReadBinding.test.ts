import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createOutlookRuntime } from '@/lib/integrations/outlook/outlookRuntime';

const m = vi.hoisted(() => ({ readConnection: vi.fn(), readCredential: vi.fn(), markNeedsAttention: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/integrations/outlook/outlookConnectionStore', () => ({ createOutlookConnectionStore: () => m }));

const scope = { organizationId: 'workspace', actorUserId: 'owner', sessionId: 'session' };
const range = { start: '2026-11-24T00:00:00.000Z', end: '2026-11-25T00:00:00.000Z' };
const current = {
  id: 'connection', revision: range.end, organizationId: scope.organizationId,
  accountId: 'replacement', consentedByUserId: scope.actorUserId, status: 'active', revokedAt: null,
};
const graph = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('AXIOM_OUTLOOK_CONNECTIONS_ENABLED', 'true');
  vi.stubEnv('OUTLOOK_AUTHORITY', 'common');
  vi.stubEnv('OUTLOOK_CLIENT_ID', '00000000-0000-4000-8000-000000000001');
  vi.stubEnv('OUTLOOK_CLIENT_SECRET', 'synthetic-only');
  vi.stubGlobal('fetch', graph);
  m.readConnection.mockResolvedValue(current);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each([
  { connectionId: current.id, connectionRevision: range.start },
  { connectionId: 'prior-connection', connectionRevision: current.revision },
])('refuses a stale displayed target before opening a credential or contacting Graph', async target => {
  const runtime = createOutlookRuntime(async () => {});
  await expect(runtime.read(scope, range, new AbortController().signal, target)).rejects.toThrow('outlook_connection_changed');
  expect(m.readCredential).not.toHaveBeenCalled();
  expect(m.markNeedsAttention).not.toHaveBeenCalled();
  expect(graph).not.toHaveBeenCalled();
});

it('does not expose the connection target to a non-owner', async () => {
  const runtime = createOutlookRuntime(async () => {});
  await expect(runtime.read({ ...scope, actorUserId: 'another-user' }, range, new AbortController().signal, {
    connectionId: current.id, connectionRevision: range.start,
  })).rejects.toThrow('outlook_mailbox_owner_required');
  expect(m.readCredential).not.toHaveBeenCalled();
  expect(graph).not.toHaveBeenCalled();
});
