import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const p = vi.hoisted(() => ({ verify: vi.fn(), decrypt: vi.fn(), lead: vi.fn(), user: vi.fn(), invocation: vi.fn(), audit: vi.fn(), transaction: vi.fn(), sdk: vi.fn(), fetcher: vi.fn() }));
vi.mock('@/lib/starterToken', () => ({ verifyStarterToken: p.verify }));
vi.mock('@/lib/security/credentialVault', () => ({ decryptCredential: p.decrypt }));
vi.mock('@/lib/db', () => ({ prisma: { lead: { findUnique: p.lead }, user: { findUnique: p.user }, aIInvocation: { create: p.invocation }, auditLog: { create: p.audit }, $transaction: p.transaction } }));
vi.mock('ai', () => ({ generateText: p.sdk, streamText: vi.fn(), Output: { object: vi.fn() } }));
import { POST } from '../route';
import { _resetAIProviderManagerForTests } from '@/lib/ai/AIProviderManager';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-not-a-credential'); vi.stubEnv('VERCEL_OIDC_TOKEN', ''); vi.stubEnv('AI_GATEWAY_MODEL', 'anthropic/claude-sonnet-5');
  vi.stubGlobal('fetch', p.fetcher); p.fetcher.mockRejectedValue(new Error('unexpected external fetch'));
  _resetAIProviderManagerForTests();
  p.verify.mockReturnValue({ leadId: 'synthetic-lead' }); p.decrypt.mockReturnValue('synthetic-decrypted-fixture');
  p.user.mockResolvedValue({ plan: 'growth' });
  p.lead.mockResolvedValue({ id: 'synthetic-lead', userId: 'synthetic-member', source: 'cloud-operator', fullPayload: { tier: 'pro', connectors: { github: { encryptedCredRef: 'synthetic-reference' } }, axiomResult: { detections: { idleResources: ['synthetic idle fixture'] } } } });
  p.invocation.mockResolvedValue({ id: 'synthetic-invocation' }); p.audit.mockResolvedValue({ id: 'synthetic-audit' });
  p.sdk.mockResolvedValue({ text: JSON.stringify({ actions: [{ id: 'synthetic-action', actionType: 'github_pr', title: 'Synthetic fixture', description: 'Do not execute', files: [{ path: 'fixture.md', content: 'Synthetic inert fixture' }], approvalRequired: true }] }), finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 }, providerMetadata: { gateway: { generationId: 'synthetic-generation' } } });
});
afterEach(() => { _resetAIProviderManagerForTests(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const request = () => new NextRequest('http://localhost/api/automation/remediate?token=synthetic-fixture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ remediationType: 'cost_idle_resources', githubOwner: 'synthetic-owner', githubRepo: 'synthetic-repository' }) });

it('mounts the real planning callback but the real unbound GitHub writer refuses before network', async () => {
  const response = await POST(request()); const body = await response.json();
  expect(response.status).toBe(200); expect(body.success).toBe(false);
  expect(p.sdk).toHaveBeenCalledTimes(1);
  expect(p.sdk.mock.calls[0][0].providerOptions.gateway.user).toBeUndefined();
  expect(p.transaction).not.toHaveBeenCalled();
  expect(body.actResults).toEqual([{ success: false, actionId: 'synthetic-action', error: 'github_legacy_write_authority_unavailable' }]);
  expect(p.fetcher).not.toHaveBeenCalled();
});
it('does not plan or contact a provider when the real observer finds no issues', async () => {
  p.lead.mockResolvedValue({ id: 'synthetic-lead', userId: 'synthetic-member', source: 'cloud-operator', fullPayload: { tier: 'pro', connectors: { github: { encryptedCredRef: 'synthetic-reference' } } } });
  const body = await (await POST(request())).json();
  expect(body.success).toBe(false); expect(body.actResults).toEqual([]);
  expect(p.sdk).not.toHaveBeenCalled(); expect(p.fetcher).not.toHaveBeenCalled(); expect(p.transaction).not.toHaveBeenCalled();
});
