import { expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { DesktopRequestPrincipal } from '@/lib/desktop/desktopSessionResolverCore';
import type { ReleaseOperationPlanTransaction } from '@/lib/agent/workflows/releaseOperationPlanStore';
import { createPrivateGovernanceRequestAuthority } from '../requestAuthorityCore';

const scope = { organizationId: 'org', actorUserId: 'actor', sessionId: 'session' };
const principal = () => ({ id: 'session', userId: 'actor', organizationId: 'org', credentialKind: 'desktop_session', role: 'admin', capabilities: [] }) as unknown as DesktopRequestPrincipal;
function fixture() {
  const controller = new AbortController();
  const resolve = vi.fn(async (): Promise<DesktopRequestPrincipal | null> => principal());
  const query = vi.fn(async (sql: TemplateStringsArray): Promise<unknown[]> => sql.join('').includes('OrgMembership')
    ? [{ organizationId: 'org', userId: 'actor', role: 'admin', acceptedAt: new Date() }]
    : [{ id: 'session', organizationId: 'org', userId: 'actor', live: true }]);
  const tx = { $queryRaw: query } as unknown as ReleaseOperationPlanTransaction;
  const authority = createPrivateGovernanceRequestAuthority({ signal: controller.signal } as NextRequest, resolve);
  return { controller, resolve, query, tx, check: () => authority(tx, scope, 'policy_admin') };
}

it('accepts only after both resolutions preserve the exact current paired principal', async () => {
  const f = fixture();
  await expect(f.check()).resolves.toBeUndefined();
  expect(f.resolve).toHaveBeenCalledTimes(2);
  expect(f.query).toHaveBeenCalledTimes(2);
  for (const call of f.resolve.mock.calls) expect(call).toEqual([
    expect.anything(), expect.objectContaining({ requiredCapability: 'policy:manage', allowApiKey: false, recordHeartbeat: false }),
  ]);
});

it('refuses cancellation while the initial session resolution is pending before any locked reads', async () => {
  const f = fixture();
  f.resolve.mockImplementationOnce(async () => { await Promise.resolve(); f.controller.abort(new Error('initial-resolution-cancelled')); return principal(); });
  await expect(f.check()).rejects.toThrow('initial-resolution-cancelled');
  expect(f.resolve).toHaveBeenCalledTimes(1);
  expect(f.query).not.toHaveBeenCalled();
});

it('refuses cancellation during the last locked read without resolving a second principal', async () => {
  const f = fixture(), original = f.query.getMockImplementation()!;
  f.query.mockImplementation(async sql => {
    const rows = await original(sql);
    if (sql.join('').includes('DesktopSessionRecord')) f.controller.abort(new Error('locked-read-cancelled'));
    return rows;
  });
  await expect(f.check()).rejects.toThrow('locked-read-cancelled');
  expect(f.query).toHaveBeenCalledTimes(2);
  expect(f.resolve).toHaveBeenCalledTimes(1);
});

it.each(['id', 'userId', 'organizationId'] as const)('refuses final paired principal %s drift after valid locked rows', async field => {
  const f = fixture();
  f.resolve.mockResolvedValueOnce(principal()).mockResolvedValueOnce({ ...principal(), [field]: 'replacement' });
  await expect(f.check()).rejects.toThrow('governance_authority_required');
  expect(f.resolve).toHaveBeenCalledTimes(2);
  expect(f.query).toHaveBeenCalledTimes(2);
});

it('refuses a final API-key principal even after valid paired and locked checks', async () => {
  const f = fixture();
  f.resolve.mockResolvedValueOnce(principal()).mockResolvedValueOnce({ ...principal(), credentialKind: 'api_key' } as unknown as DesktopRequestPrincipal);
  await expect(f.check()).rejects.toThrow('governance_authority_required');
  expect(f.resolve).toHaveBeenCalledTimes(2);
});

it('refuses final session revocation rather than returning cached initial authority', async () => {
  const f = fixture();
  f.resolve.mockResolvedValueOnce(principal()).mockResolvedValueOnce(null);
  await expect(f.check()).rejects.toThrow('governance_authority_required');
  expect(f.resolve).toHaveBeenCalledTimes(2);
  expect(f.query).toHaveBeenCalledTimes(2);
});

it('refuses cancellation while the final resolver itself is awaited', async () => {
  const f = fixture();
  f.resolve.mockResolvedValueOnce(principal()).mockImplementationOnce(async () => {
    await Promise.resolve(); f.controller.abort(new Error('final-resolution-cancelled')); return principal();
  });
  await expect(f.check()).rejects.toThrow('final-resolution-cancelled');
  expect(f.resolve).toHaveBeenCalledTimes(2);
  expect(f.query).toHaveBeenCalledTimes(2);
});
