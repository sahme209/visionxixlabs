import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/db', () => ({ prisma: {} }));
import { AIProviderManager } from '@/lib/ai/AIProviderManager';
import { VALIDATION_MATRIX } from '../platformValidationMatrix';

afterEach(() => vi.unstubAllEnvs());

it.each(['github_models', 'ollama', 'lm_studio', 'groq', 'hugging_face', 'openrouter', 'gemini', 'cloudflare', 'mock'])('does not report retained %s code as a passing service provider', provider => {
  vi.stubEnv('AI_GATEWAY_API_KEY', ''); vi.stubEnv('VERCEL_OIDC_TOKEN', '');
  const registered = new AIProviderManager().status().map(row => row.provider);
  expect(registered).not.toContain(provider);
  const row = VALIDATION_MATRIX.find(entry => entry.id === `ai.free.${provider}`);
  expect(row).toBeDefined();
  expect(row!.status).toBe('preview');
  expect(row!.nextFix).toMatch(/not registered/i);
});
