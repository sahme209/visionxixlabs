import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Keep the handler, policy resolver, capability, manager, provider, installed
// SDK/adapter and usage producer real. Only external authority/storage and the
// final fetch are synthetic. This is not real-store or provider acceptance.
const p = vi.hoisted(() => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('AI_SDK_DEFAULT_PROVIDER', undefined);
  return { fetcher, context: vi.fn(), policy: vi.fn(), credits: vi.fn(), reserve: vi.fn(), claim: vi.fn(), release: vi.fn(), transaction: vi.fn(), findUsage: vi.fn(), createUsage: vi.fn(), link: vi.fn(), events: [] as string[] };
});
vi.mock('@/lib/auth/currentContext', () => ({ currentContext: p.context }));
vi.mock('@/lib/billing/checkWorkspaceAICredits', () => ({ checkWorkspaceAICredits: p.credits }));
vi.mock('@/lib/billing/aiCreditReservation', () => ({ reserveAICredits: p.reserve, claimLegacyAICreditDispatch: p.claim, releaseAICreditReservation: p.release }));
vi.mock('@/lib/db', () => ({ prisma: { organizationAIProviderPolicy: { findUnique: p.policy }, $transaction: p.transaction } }));
import { POST } from '../route';
import { _resetAIProviderManagerForTests } from '@/lib/ai/AIProviderManager';

const model = 'anthropic/claude-sonnet-5';
const scope = { organizationId: 'synthetic-workspace', userId: 'synthetic-member', correlationId: 'synthetic-request' };
beforeEach(() => {
  vi.resetAllMocks(); p.events = [];
  vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-not-a-real-key');
  vi.stubEnv('VERCEL_OIDC_TOKEN', ''); vi.stubEnv('AI_GATEWAY_MODEL', model);
  _resetAIProviderManagerForTests();
  p.context.mockResolvedValue({ isAuthenticated: true, ...scope });
  p.policy.mockResolvedValue({ enabled: true, allowedProviders: ['vercel_gateway'], modelSelections: {}, fallbackOrder: ['vercel_gateway'] });
  p.credits.mockResolvedValue({ kind: 'allow' });
  p.reserve.mockImplementation(async () => { p.events.push('reserve'); return { ok: true, reused: false, reservation: { id: 'synthetic-hold' } }; });
  p.claim.mockImplementation(async () => { p.events.push('claim'); return true; });
  p.createUsage.mockImplementation(async () => { p.events.push('usage'); return { id: 'synthetic-usage', billingStatus: 'pending' }; });
  p.findUsage.mockResolvedValue(null);
  p.link.mockImplementation(async () => { p.events.push('link'); return { count: 1 }; });
  p.transaction.mockImplementation(async callback => callback({ $queryRawUnsafe: async () => [{ id: 'synthetic-hold', organizationId: scope.organizationId, status: 'dispatch_unknown', usageEventId: null }], usageEvent: { findUnique: p.findUsage, create: p.createUsage }, aIUsageReservation: { updateMany: p.link } }));
  p.fetcher.mockImplementation(async () => {
    p.events.push('transport');
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Synthetic result' }], finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: { total: 5, noCache: 5 }, outputTokens: { total: 2, text: 2 } }, providerMetadata: { gateway: { generationId: 'synthetic-generation' } }, warnings: [] }), { headers: { 'content-type': 'application/json' } });
  });
});
afterEach(() => { _resetAIProviderManagerForTests(); vi.unstubAllEnvs(); });

function request(key = 'synthetic_request_123456') {
  return new NextRequest('http://localhost/api/ai/generate', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key, 'x-correlation-id': scope.correlationId }, body: JSON.stringify({ prompt: 'Summarize synthetic input.', maxTokens: 20, organizationId: 'forged-workspace', userId: 'forged-member' }) });
}

it('joins actual route/admission/installed SDK/usage code with trusted attribution and ordered one-attempt dispatch', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).data).toMatchObject({ text: 'Synthetic result', gatewayGenerationId: 'synthetic-generation', usage: { promptTokens: 5, completionTokens: 2 } });
  expect(p.events).toEqual(['reserve', 'claim', 'transport', 'usage', 'link']);
  expect(p.fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = p.fetcher.mock.calls[0];
  expect(String(url)).toBe('https://ai-gateway.vercel.sh/v3/ai/language-model');
  const body = JSON.parse(String(init.body));
  expect(new Headers(init.headers).get('ai-language-model-id')).toBe(model);
  expect(body).toMatchObject({ maxOutputTokens: 20, providerOptions: { gateway: { user: scope.organizationId, tags: ['product:axiom-agent', `correlation:${scope.correlationId}`] } } });
  expect(p.createUsage).toHaveBeenCalledWith({ data: expect.objectContaining({ organizationId: scope.organizationId, triggeredBy: scope.userId, correlationId: scope.correlationId, externalUsageId: 'synthetic-generation', billingStatus: 'pending', inputTokens: 5, outputTokens: 2 }) });
  expect(p.link).toHaveBeenCalledWith({ where: { id: 'synthetic-hold', organizationId: scope.organizationId, status: 'dispatch_unknown', usageEventId: null }, data: { status: 'pending_settlement', usageEventId: 'synthetic-usage' } });
  expect(p.release).not.toHaveBeenCalled();
});

it('does not retry the installed SDK transport or release a claimed hold on a network failure', async () => {
  p.fetcher.mockImplementation(async () => { p.events.push('transport'); throw new TypeError('synthetic-offline-failure'); });
  expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
  expect(p.events).toEqual(['reserve', 'claim', 'transport']);
  expect(p.fetcher).toHaveBeenCalledTimes(1); expect(p.createUsage).not.toHaveBeenCalled(); expect(p.release).not.toHaveBeenCalled();
});
it('retains claimed uncertainty if the actual usage producer cannot persist the returned envelope', async () => {
  p.createUsage.mockRejectedValue(new Error('synthetic-write-failure'));
  expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
  expect(p.fetcher).toHaveBeenCalledTimes(1); expect(p.createUsage).toHaveBeenCalledTimes(1); expect(p.link).not.toHaveBeenCalled(); expect(p.release).not.toHaveBeenCalled();
});
it('refuses a reused reservation before the real manager/SDK transport', async () => {
  p.reserve.mockResolvedValue({ ok: true, reused: true, reservation: { id: 'synthetic-hold' } });
  expect((await POST(request())).status).toBeGreaterThanOrEqual(400);
  expect(p.claim).not.toHaveBeenCalled(); expect(p.fetcher).not.toHaveBeenCalled(); expect(p.release).not.toHaveBeenCalled();
});
it('refuses a missing request key before any reservation or SDK transport', async () => {
  const response = await POST(request(''));
  expect(response.status).toBe(400); expect((await response.json()).error.code).toBe('ai.idempotency_key_required');
  expect(p.reserve).not.toHaveBeenCalled(); expect(p.fetcher).not.toHaveBeenCalled();
});
