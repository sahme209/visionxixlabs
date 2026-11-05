import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ports = vi.hoisted(() => ({ sdk: vi.fn(), invocation: vi.fn(), transaction: vi.fn() }));
vi.mock('ai', () => ({ generateText: ports.sdk, streamText: vi.fn(), Output: { object: vi.fn() } }));
vi.mock('@/lib/db', () => ({ prisma: { aIInvocation: { create: ports.invocation }, $transaction: ports.transaction } }));

import { POST } from '../route';
import { _resetAIProviderManagerForTests } from '@/lib/ai/AIProviderManager';
import { checkRateLimit } from '@/lib/rateLimit';

function request(ip: string) {
  return new NextRequest('http://localhost/api/visionxix-ai-chat', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain this product.' }] }),
  });
}

describe('public assistant attributed-admission regression (synthetic external ports)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-not-a-provider-credential');
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('AI_GATEWAY_MODEL', 'anthropic/claude-sonnet-5');
    _resetAIProviderManagerForTests();
    ports.invocation.mockResolvedValue({ id: 'synthetic-log' });
    ports.sdk.mockResolvedValue({ text: 'Synthetic fixture response', finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      providerMetadata: { gateway: { generationId: 'synthetic-generation' } } });
  });
  afterEach(() => { _resetAIProviderManagerForTests(); vi.unstubAllEnvs(); });

  const cases = [
    { label: 'configured valid request', body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain this product.' }] }), configured: true },
    { label: 'unconfigured valid request', body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain this product.' }] }), configured: false },
    { label: 'configured malformed JSON', body: '{', configured: true },
    { label: 'unconfigured malformed JSON', body: '{', configured: false },
    { label: 'empty message list', body: JSON.stringify({ messages: [] }), configured: true },
    { label: 'caller-supplied authority claims', body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain this product.' }], organizationId: 'synthetic-owner', userId: 'synthetic-actor', admission: true, credits: 1000, idempotencyKey: 'synthetic-request-123456' }), configured: true },
  ];
  it.each(cases)('refuses $label before SDK or database activity', async ({ label, body, configured }) => {
    if (!configured) vi.stubEnv('AI_GATEWAY_API_KEY', '');
    const req = new NextRequest('http://localhost/api/visionxix-ai-chat', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': `synthetic-containment-${label}`, 'idempotency-key': 'synthetic-request-123456', 'x-organization-id': 'synthetic-owner' }, body,
    });
    const response = await POST(req);
    const observed = { status: response.status, body: await response.json(), sdkCalls: ports.sdk.mock.calls.length, invocationCalls: ports.invocation.mock.calls.length, transactionCalls: ports.transaction.mock.calls.length };
    expect(observed).toEqual({ status: 503, body: { error: expect.any(String), code: 'ai.public_admission_unavailable' }, sdkCalls: 0, invocationCalls: 0, transactionCalls: 0 });
  });

  it('preserves the IP rate-limit refusal ahead of the unavailable gate', async () => {
    for (let i = 0; i < 10; i++) expect(checkRateLimit('visionxix-chat:synthetic-containment-throttled')).toBe(true);
    const response = await POST(request('synthetic-containment-throttled'));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'Too many requests. Please try again in a minute.' });
    expect(ports.sdk).not.toHaveBeenCalled();
    expect(ports.invocation).not.toHaveBeenCalled();
    expect(ports.transaction).not.toHaveBeenCalled();
  });
});
