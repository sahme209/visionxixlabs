import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ports = vi.hoisted(() => ({ context: vi.fn(), policy: vi.fn(), sdk: vi.fn(), transaction: vi.fn(), invocation: vi.fn() }));
vi.mock('@/lib/auth/currentContext', () => ({ currentContext: ports.context }));
vi.mock('@/lib/db', () => ({ prisma: {
  organizationAIProviderPolicy: { findUnique: ports.policy },
  $transaction: ports.transaction, aIInvocation: { create: ports.invocation },
} }));
vi.mock('ai', () => ({ generateText: ports.sdk, streamText: vi.fn(), Output: { object: vi.fn() } }));

import { GET, POST } from '../route';
import { _resetAIProviderManagerForTests } from '@/lib/ai/AIProviderManager';

describe('workspace AI configuration check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-not-a-credential');
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('AI_GATEWAY_MODEL', 'anthropic/claude-sonnet-5');
    _resetAIProviderManagerForTests();
    ports.context.mockResolvedValue({ isAuthenticated: true, organizationId: 'synthetic-workspace', userId: 'synthetic-member', roles: ['member'] });
    ports.policy.mockResolvedValue({ enabled: true, allowedProviders: ['vercel_gateway'], modelSelections: {}, fallbackOrder: ['vercel_gateway'] });
  });
  afterEach(() => { _resetAIProviderManagerForTests(); vi.unstubAllEnvs(); });
  const request = (method: 'GET' | 'POST') => new NextRequest('http://localhost/api/ai/health', { method });

  it.each([['GET', GET], ['POST', POST]] as const)('%s checks configuration without issuing billable inference', async (method, handler) => {
    const response = await handler(request(method));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toEqual({
      rows: [{ provider: 'vercel_gateway', model: expect.any(String) }],
      policyEnabled: true,
      health: 'not_measured',
      generatedAt: expect.any(String),
    });
    expect(ports.policy).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'synthetic-workspace' } }));
    expect(ports.sdk).not.toHaveBeenCalled();
    expect(ports.transaction).not.toHaveBeenCalled();
    expect(ports.invocation).not.toHaveBeenCalled();
  });

  it('keeps other service configuration out of a workspace that has not approved it', async () => {
    ports.policy.mockResolvedValue({ enabled: true, allowedProviders: ['openai'], modelSelections: {}, fallbackOrder: ['openai'] });
    const response = await POST(request('POST'));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ rows: [], policyEnabled: true, health: 'not_measured' });
    expect(ports.sdk).not.toHaveBeenCalled();
  });

  it('preserves authentication refusal before policy and SDK', async () => {
    ports.context.mockResolvedValue({ isAuthenticated: false, organizationId: null });
    expect((await POST(request('POST'))).status).not.toBe(200);
    expect(ports.policy).not.toHaveBeenCalled(); expect(ports.sdk).not.toHaveBeenCalled();
  });
  it('preserves unavailable-policy refusal before SDK', async () => {
    ports.policy.mockRejectedValue(new Error('synthetic storage outage'));
    expect((await POST(request('POST'))).status).not.toBe(200);
    expect(ports.sdk).not.toHaveBeenCalled();
  });
  it('keeps a workspace without an opt-in policy disabled', async () => {
    ports.policy.mockResolvedValue(null);
    const response = await POST(request('POST'));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ rows: [], policyEnabled: false, health: 'not_measured' });
    expect(ports.sdk).not.toHaveBeenCalled();
  });
});
