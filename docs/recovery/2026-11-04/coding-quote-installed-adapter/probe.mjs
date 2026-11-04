import assert from 'node:assert/strict';
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
const input = {
  prompt: [{ role: 'user', content: [{ type: 'text', text: 'synthetic' }] }],
  maxOutputTokens: 137,
  providerOptions: { gateway: { only: ['synthetic-upstream'], order: ['synthetic-upstream'] } },
  abortSignal: new AbortController().signal,
};
await assert.rejects(gateway('synthetic/model').doGenerate(input));
assert.equal(calls, 1);
assert.equal(captured.maxOutputTokens, 137);
assert.deepEqual(captured.providerOptions, input.providerOptions);
assert.equal(Object.hasOwn(captured, 'abortSignal'), false);
assert.equal(Object.hasOwn(captured, 'max_tokens'), false);
console.log(JSON.stringify({ adapterCalls: calls, outputLimitPreserved: true, routingPreserved: true, abortSignalNotSerialized: true, networkCalls: 0, responseQualification: false }));
