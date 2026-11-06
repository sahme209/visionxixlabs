'use strict';
// Explicit bounded compiler preparation, never a runtime entry or identity test.
// Invoke from an owned staged source/dependency tree, before manifest generation.
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const packageRoot='/Volumes/Axiom Synthetic Issuer-c3b7bf334ce56a64575183b7a66e5109';
const preimport="'use strict';\n{const observation=require("+JSON.stringify(packageRoot+'/node_modules/@axiom/verified-issuer-runtime/internal/verify-package.cjs')+").verifyPackageFiles("+JSON.stringify(packageRoot)+");if(!observation||observation.qualification!==\"package_file_set_verified\")throw Error(\"fixture_package_unavailable\");}\n";
const policy=require('./fixture-producer-compiler-policy.cjs').createFixtureProducerCompilerPolicy(root);
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
const output = path.join(root, '.next/server/__axiom_private_fixture__');
const forbidden = /(?:^|\/)lib\/(?:db|security\/credentialVault|desktop\/desktopSession|desktop\/desktopToken)\.tsx?$/;
const compiler = webpack({
  mode: 'production', target: 'node', context: root,
  entry: path.join(root, 'lib/governance/qualification/privateSyntheticFixtureEntry.ts'),
  output: { path: output, filename: 'fixture-producer.cjs', library: { type: 'commonjs2' } },
  devtool: false, optimization: { minimize: false },
  resolve: { extensions: ['.ts', '.tsx', '.js', '.cjs', '.json'], alias: { '@': root, 'server-only$': false,...policy.alias } },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(__dirname, 'private-bootstrap-typescript-loader.cjs') }] },
  externalsPresets: { node: true },
  externals: [policy.external],
  plugins: [new webpack.BannerPlugin({banner:preimport,raw:true,entryOnly:true}),policy.plugin,{ apply(compilation) {
    compilation.hooks.normalModuleFactory.tap('PrivateBootstrapClosure', factory => {
      factory.hooks.afterResolve.tap('PrivateBootstrapClosure', data => {
        const file = data.createData?.resource?.split('?')[0];
        if (file && forbidden.test(file)) throw Error('private_fixture_legacy_resource_import');
      });
    });
  } }],
});
compiler.run((error, stats) => compiler.close(closeError => {
  if (error || closeError || !stats || stats.hasErrors()) {
    fs.rmSync(path.join(output, 'fixture-producer.cjs'), { force: true });
    process.stderr.write('private_fixture_emission_unavailable\n');
    if (stats) process.stderr.write(stats.toString({ all: false, errors: true }) + '\n');
    process.exitCode = 1;
    return;
  }
  fs.chmodSync(path.join(output,'fixture-producer.cjs'),0o600);
  process.stdout.write('private_fixture_emitted_unqualified_business_channel_unmounted\n');
}));
