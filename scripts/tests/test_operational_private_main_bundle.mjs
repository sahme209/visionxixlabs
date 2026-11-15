import test, {afterEach, mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const relative = 'lib/governance/platform/nativeTime/';
const names = ['installedOperationalMain.ts', 'operationalNativePorts.ts', 'operationalSource.ts'];
const owned = [];
afterEach(async () => { mock.restoreAll(); for (const dir of owned.splice(0)) await fs.rm(dir, {recursive:true, force:true}); });
async function fixture() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'axiom-main-bundle-test-')));
  owned.push(root);
  await fs.mkdir(path.join(root, relative), {recursive:true});
  for (const name of names) await fs.copyFile(path.join(repo, relative, name), path.join(root, relative, name));
  return root;
}
const builder = () => import('../build-operational-private-main.mjs');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('the actual supplier source compiles into one complete hash-bound ESM without loading its addon', async () => {
  const root = await fixture();
  const {compileOperationalPrivateMain} = await builder();
  const first = await compileOperationalPrivateMain({sourceRoot:root});
  const second = await compileOperationalPrivateMain({sourceRoot:root});
  assert.equal(first.code, second.code, 'unchanged inputs must produce the same complete owner-hashed file');
  assert.equal(first.receipt.output.sha256, sha(first.code));
  assert.equal(first.receipt.output.name, 'main.mjs');
  assert.deepEqual(first.receipt.externals, ['node:module', 'node:process']);
  assert.deepEqual(Object.keys(first.receipt.sources).sort(), names.map(n => relative+n).sort());
  for (const name of names) assert.equal(first.receipt.sources[relative+name], sha(await fs.readFile(path.join(root,relative,name))));
  assert.equal(first.receipt.targetExecuted, false);
  assert.equal(first.receipt.nativeQualified, false);
  assert.equal(first.receipt.governanceEnabled, false);
  assert.equal(first.receipt.compiler.hashes.recipe, sha(await fs.readFile(path.join(repo,'scripts/build-operational-private-main.mjs'))));
  assert.ok(!first.code.includes(root) && !first.code.includes('sourceMappingURL'));
  // Syntax-only: executing this fixed main would attempt privileged addon load.
  const check = spawnSync(process.execPath, ['--input-type=module', '--check'], {input:first.code, encoding:'utf8'});
  assert.equal(check.status, 0, check.stderr);
});

test('an added runtime dependency is refused instead of escaping the main-file binding', async () => {
  const root = await fixture();
  await fs.appendFile(path.join(root,relative,names[0]), '\nimport "node:fs";\n');
  const {compileOperationalPrivateMain} = await builder();
  await assert.rejects(compileOperationalPrivateMain({sourceRoot:root}), /operational_main_bundle_refused/);
});

test('dynamic imports are refused even if the compiler could inline them', async () => {
  const root = await fixture();
  await fs.appendFile(path.join(root,relative,names[0]), '\nvoid import("./operationalSource");\n');
  const {compileOperationalPrivateMain} = await builder();
  await assert.rejects(compileOperationalPrivateMain({sourceRoot:root}), /operational_main_bundle_refused/);
});

for (const [name,addition] of [
  ['standalone loader', '\nconst extraLoader = createRequire(import.meta.url); extraLoader("/tmp/unbound.cjs");\n'],
  ['aliased loader', '\nconst extraFactory = createRequire; extraFactory(import.meta.url)("/tmp/unbound.cjs");\n'],
  ['alternative module loader', '\nimport { Module as extraModule } from "node:module"; extraModule._load("/tmp/unbound.cjs");\n'],
]) test(`${name} cannot add an unhashed runtime dependency beside the approved addon`, async()=>{
  const root=await fixture();
  await fs.appendFile(path.join(root,relative,names[0]),addition);
  const {compileOperationalPrivateMain}=await builder();
  await assert.rejects(compileOperationalPrivateMain({sourceRoot:root}), /operational_main_bundle_refused/);
});

test('a symlink source cannot substitute bytes into the accepted source capsule', async () => {
  const root = await fixture();
  const member = path.join(root,relative,names[1]);
  await fs.rename(member, member+'.saved');
  await fs.symlink(member+'.saved', member);
  const {compileOperationalPrivateMain} = await builder();
  await assert.rejects(compileOperationalPrivateMain({sourceRoot:root}), /operational_main_bundle_refused/);
});

test('a source change after capture refuses the result rather than publishing a stale source binding', async () => {
  const root = await fixture();
  const originalOpen = fs.open;
  let changed = false;
  mock.method(fs, 'open', async function(file, ...args) {
    const handle = await originalOpen.call(fs, file, ...args);
    if (!changed && file === path.join(root,relative,names[2])) {
      changed = true;
      const close = handle.close.bind(handle);
      handle.close = async () => { await close(); await fs.appendFile(path.join(root,relative,names[0]), '\n// changed after source capture\n'); };
    }
    return handle;
  });
  const {compileOperationalPrivateMain} = await builder();
  await assert.rejects(compileOperationalPrivateMain({sourceRoot:root}), /operational_main_bundle_refused/);
  assert.equal(changed, true, 'the test must actually change the captured source');
});

test('the materializer writes only a new capsule and never overwrites an existing output', async () => {
  const root = await fixture();
  const outputDirectory = path.join(root, 'capsule');
  const {writeOperationalPrivateMain} = await builder();
  const receipt = await writeOperationalPrivateMain({sourceRoot:root, outputDirectory});
  assert.deepEqual((await fs.readdir(outputDirectory)).sort(), ['SOURCE.json','main.mjs']);
  const bytes = await fs.readFile(path.join(outputDirectory,'main.mjs'));
  assert.equal(sha(bytes), receipt.output.sha256);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(outputDirectory,'SOURCE.json'),'utf8')), receipt);
  await assert.rejects(writeOperationalPrivateMain({sourceRoot:root,outputDirectory}), /operational_main_bundle_refused/);
  assert.deepEqual(await fs.readFile(path.join(outputDirectory,'main.mjs')), bytes);
});

test('a symlink output parent is refused without writing through it', async () => {
  const root = await fixture();
  await fs.mkdir(path.join(root, 'real'));
  await fs.symlink(path.join(root,'real'), path.join(root,'linked'));
  const {writeOperationalPrivateMain} = await builder();
  await assert.rejects(writeOperationalPrivateMain({sourceRoot:root, outputDirectory:path.join(root,'linked','capsule')}), /operational_main_bundle_refused/);
  assert.deepEqual(await fs.readdir(path.join(root,'real')), []);
});

test('replacing a newly written output with a same-bytes symlink cannot produce an accepted capsule', async () => {
  const root=await fixture(), outputDirectory=path.join(root,'capsule');
  const originalOpen=fs.open;
  let replaced=false;
  mock.method(fs,'open',async function(file,...args) {
    const h=await originalOpen.call(fs,file,...args);
    if (!replaced && file===path.join(outputDirectory,'main.mjs')) {
      replaced=true;
      const close=h.close.bind(h);
      h.close=async()=>{
        await close();
        const shadow=path.join(root,'same-bytes-main.mjs');
        await fs.rename(file,shadow);
        await fs.symlink(shadow,file);
      };
    }
    return h;
  });
  const {writeOperationalPrivateMain}=await builder();
  await assert.rejects(writeOperationalPrivateMain({sourceRoot:root,outputDirectory}), /operational_main_bundle_refused/);
  assert.equal(replaced,true);
});
