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

  it('does not dispatch SDK generation without attributed admission', async () => {
    const response = await POST(request('synthetic-public-admission'));
    // Capture the actual route result independently from the desired no-dispatch invariant.
    expect({ status: response.status, body: await response.json(), sdkCalls: ports.sdk.mock.calls.length,
      model: ports.sdk.mock.calls[0]?.[0]?.model, outputCap: ports.sdk.mock.calls[0]?.[0]?.maxOutputTokens,
      gatewayUser: ports.sdk.mock.calls[0]?.[0]?.providerOptions?.gateway?.user,
      transactionCalls: ports.transaction.mock.calls.length }).toEqual({
      status: expect.any(Number), body: expect.any(Object), sdkCalls: 0,
      model: undefined, outputCap: undefined, gatewayUser: undefined, transactionCalls: 0,
    });
  });

  it('retains the real IP rate-limit refusal before SDK dispatch', async () => {
    for (let i = 0; i < 10; i++) expect(checkRateLimit('visionxix-chat:synthetic-public-throttled')).toBe(true);
    expect((await POST(request('synthetic-public-throttled'))).status).toBe(429);
    expect(ports.sdk).not.toHaveBeenCalled();
  });

  it('retains the missing-configuration refusal before SDK dispatch', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    expect((await POST(request('synthetic-public-unconfigured'))).status).toBe(503);
    expect(ports.sdk).not.toHaveBeenCalled();
  });
});
