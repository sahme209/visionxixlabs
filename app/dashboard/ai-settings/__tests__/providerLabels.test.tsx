/** @vitest-environment jsdom */
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AISettingsPage from '../page';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([
  ['vercel_gateway', 'AI Gateway'],
  ['xai', 'xAI Grok'],
])('names %s in its active summary, provider card and accessible toggle without dispatch', async (provider, label) => {
  const fetcher = vi.fn(async (url: string) => ({ json: async () => url === '/api/ai/status'
    ? { ok: true, data: { policyEnabled: true, activeProvider: provider, activeModel: 'vendor/model', providers: [{ provider, configured: true, defaultModel: 'vendor/model', priority: 0, models: [] }] } }
    : { ok: true, data: { policy: { enabled: true, allowedProviders: [provider], modelSelections: {}, fallbackOrder: [provider] }, availableProviders: [provider] } } }));
  vi.stubGlobal('fetch', fetcher);
  render(createElement(AISettingsPage));
  expect(await screen.findByRole('switch', { name: `Turn off ${label}` })).toBeDefined();
  expect(screen.getAllByText(label)).toHaveLength(3);
  expect(screen.queryByRole('switch', { name: /undefined/ })).toBeNull();
  expect(fetcher.mock.calls.map(([url]) => url).sort()).toEqual(['/api/account/ai-policy', '/api/ai/status']);
});
