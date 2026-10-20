import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const policy = require('../../scripts/fixtures/ownedWebsitePolicy.cjs');
const defaults = require('next/dist/server/config-shared').defaultConfig;

it('disables only the unsupported dev debug channel in owned options without mutating pinned defaults', () => {
  expect(require('next/package.json').version).toBe('16.3.8');
  expect(defaults.experimental.reactDebugChannel).toBe(true);
  const actual = { experimental: { ...defaults.experimental, cpus: 1 }, typescript: { ignoreBuildErrors: false }, serverExternalPackages: ['provider-sdk'] };
  const options = policy.ownedNextOptions({ root: '/workspace/owned', dist: '/workspace/owned/.next/visual-fixture', appPort: 38001, actual });
  expect(options.conf.experimental).toEqual({ ...actual.experimental, reactDebugChannel: false });
  expect(actual.experimental.reactDebugChannel).toBe(true); expect(defaults.experimental.reactDebugChannel).toBe(true);
  expect(options.conf.serverExternalPackages).toBe(actual.serverExternalPackages);
});

it('actual pinned Flight decoder waits for missing debug reference, then resolves after debug data', async () => {
  const file = require.resolve('next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js');
  const source = readFileSync(file, 'utf8');
  const webpack = Object.assign(() => { throw Error('unexpected_module_load'); }, { u: () => { throw Error('unexpected_chunk_load'); } });
  const decoderModule = { exports: {} as { createFromReadableStream: (stream: ReadableStream<Uint8Array>, options?: unknown) => PromiseLike<unknown> } };
  const restrictedRequire = (name: string) => { if (!['react', 'react-dom'].includes(name)) throw Error('unexpected_decoder_dependency'); return require(name); };
  vm.compileFunction(source, ['require', 'module', 'exports', '__webpack_require__', 'process'], { filename: file })(restrictedRequire, decoderModule, decoderModule.exports, webpack, { env: { NODE_ENV: 'development' } });
  let primary!: ReadableStreamDefaultController<Uint8Array>; let debug!: ReadableStreamDefaultController<Uint8Array>;
  const input = new ReadableStream<Uint8Array>({ start(controller) { primary = controller; } });
  const debugInput = new ReadableStream<Uint8Array>({ start(controller) { debug = controller; } });
  const encoder = new TextEncoder(); let settled = false;
  const decoded = Promise.resolve(decoderModule.exports.createFromReadableStream(input, { debugChannel: { readable: debugInput } }));
  decoded.then(() => { settled = true; }, () => { settled = true; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    primary.enqueue(encoder.encode('0:D"$1"\n0:{"ok":true}\n')); primary.close();
    await new Promise(resolve => setImmediate(resolve));
    expect(settled).toBe(false);
    debug.enqueue(encoder.encode('1:{"name":"Synthetic","env":"Server"}\n')); debug.close();
    const result = await Promise.race([decoded, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('decoder_test_bound')), 500); })]);
    expect(result).toEqual({ ok: true }); expect(settled).toBe(true);
  } finally { if (timer) clearTimeout(timer); try { primary.error(Error('test_cleanup')); } catch {} try { debug.error(Error('test_cleanup')); } catch {} }
});
