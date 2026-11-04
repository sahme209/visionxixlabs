import assert from 'node:assert/strict';
import { generateText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
let calls = 0;
let captured;
const gateway = createGateway({
  apiKey: 'synthetic-local-only',
  baseURL: 'https://offline.invalid/v1',
  fetch: async (_url, init) => {
    calls++;
    captured = JSON.parse(init.body);
    throw new Error('intentional-offline-stop');
  },
});
await assert.rejects(generateText({
  model: gateway('synthetic/model'),
  prompt: 'synthetic',
  maxOutputTokens: 137,
  maxRetries: 0,
  providerOptions: { gateway: { only: ['synthetic-upstream'], order: ['synthetic-upstream'] } },
}));
assert.equal(calls, 1);
assert.equal(captured.maxOutputTokens, 137);
assert.deepEqual(captured.providerOptions.gateway.only, ['synthetic-upstream']);
assert.deepEqual(captured.providerOptions.gateway.order, ['synthetic-upstream']);
assert.equal(captured.prompt[0].role, 'user');
console.log(JSON.stringify({ sdkToAdapterCapture: 'pass', adapterCalls: calls, networkCalls: 0, successfulResponse: false, axiomManagerQualified: false }));
