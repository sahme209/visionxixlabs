/* eslint-disable @typescript-eslint/no-require-imports -- fixture-only source loader, no build/server */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
assert.equal(process.env.AXIOM_OWNED_AZURE_WIRE, '1');
const root = path.resolve(__dirname, '../..');
const azureRoot = path.join(root, 'lib/cloud/azure/enrollment') + path.sep;
const previous = require.extensions['.ts'];
require.extensions['.ts'] = function (module, file) {
  assert.ok(file.startsWith(azureRoot), 'azure_probe_source_scope_required');
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  module._compile(output, file);
};
(async () => {
  const { createAzureProviderClient } = require(path.join(azureRoot, 'providerClient.ts'));
  const input = { tenantId: '11111111-1111-4111-8111-111111111111', subscriptionId: '22222222-2222-4222-8222-222222222222', clientId: '33333333-3333-4333-8333-333333333333', clientSecret: 'owned-azure-fixture-never-valid-secret' };
  assert.throws(() => require('node:https').request('https://attacker.invalid/forbidden'), /owned_azure_egress_denied/);
  const client = createAzureProviderClient(); // actual default production transport, no mocked SDK/client.
  assert.deepEqual(await client.validate(input), { tenantId: input.tenantId, subscriptionId: input.subscriptionId });
  const page = await client.read(input);
  assert.ok(page.complete === false && page.limit === 100 && page.resourceGroups.length === 1 && page.resourceGroups[0].name === 'owned-azure-group');
  assert.ok(!JSON.stringify(page).includes(input.clientSecret));
  process.stdout.write(JSON.stringify({ verified: ['actual_source_default_transport', 'actual_msal_token_post', 'actual_arm_first_page_serialization', 'source_streaming_budget', 'no_pagination_or_public_network'], notVerified: ['real_azure', 'routes', 'database', 'desktop'] }) + '\n');
})().catch(() => { process.stderr.write('owned_azure_source_probe_failed\n'); process.exitCode = 1; }).finally(() => { if (previous) require.extensions['.ts'] = previous; else delete require.extensions['.ts']; });
