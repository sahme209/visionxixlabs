'use strict';
// Ordinary compiler regression: bundles actual source as data, never executes it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
const swc = require('next/dist/build/swc');
test('actual canonical module remains parseable after production DefinePlugin replacement', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-canonical-minify-'));
 try {
  const compiler = webpack({ mode: 'production', target: 'node', entry: path.resolve(__dirname, '../index.cjs'), output: { path: dir, filename: 'canonical.js' }, optimization: { minimize: false }, plugins: [new webpack.DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('production') })], externals: [({ request }, callback) => path.isAbsolute(request) ? callback() : callback(null, `commonjs ${request}`)] });
  const stats = await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(closeError => error || closeError ? reject(error || closeError) : resolve(stats))));
  assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
  await swc.loadBindings();
  const source = fs.readFileSync(path.join(dir, 'canonical.js'), 'utf8');
  await swc.minify(source, { compress: { inline: 2, global_defs: { 'process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE': false }, keep_classnames: false, keep_fnames: false }, mangle: { reserved: ['AbortSignal'], disableCharFreq: true }, module: 'unknown', output: { comments: false } });
 } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
