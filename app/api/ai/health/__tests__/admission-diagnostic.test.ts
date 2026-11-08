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

describe('health inference admission diagnosis — synthetic external ports', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-not-a-credential');
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('AI_GATEWAY_MODEL', 'anthropic/claude-sonnet-5');
    _resetAIProviderManagerForTests();
    ports.context.mockResolvedValue({ isAuthenticated: true, organizationId: 'synthetic-workspace', userId: 'synthetic-member', roles: ['member'] });
    ports.policy.mockResolvedValue({ enabled: true, allowedProviders: ['vercel_gateway'], modelSelections: {}, fallbackOrder: ['vercel_gateway'] });
    ports.sdk.mockResolvedValue({ text: 'OK', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 1, totalTokens: 11 }, providerMetadata: { gateway: { generationId: 'synthetic-generation' } } });
  });
  afterEach(() => { _resetAIProviderManagerForTests(); vi.unstubAllEnvs(); });
  const request = (method: 'GET' | 'POST') => new NextRequest('http://localhost/api/ai/health', { method });

  it.each([['GET', GET], ['POST', POST]] as const)('%s currently reaches inference without attribution or accounting (characterization)', async (method, handler) => {
    const response = await handler(request(method));
    expect(response.status).toBe(200);
    expect(ports.policy).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'synthetic-workspace' } }));
    expect(ports.sdk).toHaveBeenCalledTimes(1);
    expect(ports.sdk.mock.calls[0][0]).toMatchObject({ prompt: 'Reply with OK.', maxOutputTokens: 8, providerOptions: { gateway: { user: undefined, tags: ['product:axiom-agent', 'request:unattributed'] } } });
    expect(ports.transaction).not.toHaveBeenCalled();
    expect(ports.invocation).not.toHaveBeenCalled();
  });

  // Known gap (desired contract, not yet built): it.fails keeps CI green while this stays RED; flip to it() when the health route is fixed.
  it.fails('does not infer a paid health allowance from provider approval alone (desired contract, intentionally RED)', async () => {
    await POST(request('POST'));
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
    expect((await POST(request('POST'))).status).toBe(200);
    expect(ports.sdk).not.toHaveBeenCalled();
  });
});
