/** Build-time materialization only. Never imports the resulting program/addon,
 * installs privileged files, or qualifies a native host or provider runtime. */
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from 'typescript';

const toolRequire = createRequire(import.meta.url);
const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = 'lib/governance/platform/nativeTime/';
const members = ['installedOperationalMain.ts', 'operationalNativePorts.ts', 'operationalSource.ts'];
const ids = members.map(name => 'axiom:'+name);
const marker = 'axiom:server-only-marker';
const externals = ['node:module','node:process'];
const addon = '/opt/axiom-operational-time/private/operational.node';
const limit = 65536;
const fail = () => { throw Error('operational_main_bundle_refused'); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const signature = s => [s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
const directoryIdentity = s => [s.dev,s.ino,s.mode,s.uid].map(String).join(':');

async function sourceFile(root, relative) {
  let parent = root;
  for (const part of path.dirname(relative).split('/')) {
    parent = path.join(parent,part);
    const s = await fs.lstat(parent);
    if (!s.isDirectory() || s.isSymbolicLink()) fail();
  }
  const file = path.join(root,relative);
  const h = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await h.stat({bigint:true});
    if (!before.isFile() || before.nlink !== 1n || before.size < 1n || before.size > BigInt(limit)) fail();
    const buffer = Buffer.alloc(limit+1);
    const {bytesRead} = await h.read(buffer,0,buffer.length,0);
    const after = await h.stat({bigint:true});
    if (signature(before)!==signature(after) || BigInt(bytesRead)!==after.size) fail();
    const bytes = buffer.subarray(0,bytesRead);
    const code = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    return {code,sha256:hash(bytes),signature:signature(after)};
  } finally { await h.close(); }
}

function parsed(code, kind=ts.ScriptKind.TS) {
  const tree = ts.createSourceFile('capsule',code,ts.ScriptTarget.Latest,true,kind);
  if (tree.parseDiagnostics.length) fail();
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.kind===ts.SyntaxKind.ImportKeyword || ts.isImportEqualsDeclaration(node)) fail();
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) fail();
    ts.forEachChild(node,visit);
  }
  visit(tree);
  return tree;
}

function checkCode(code, root) {
  if (Buffer.byteLength(code)>262144 || code.includes(root) || code.includes('/Users/') || code.includes('file://') || /sourceMappingURL\s*=/.test(code)) fail();
  const tree = parsed(code,ts.ScriptKind.JS);
  const imports=[], requireNames=new Set();
  for (const statement of tree.statements) if (ts.isImportDeclaration(statement)) {
    if (!ts.isStringLiteral(statement.moduleSpecifier)) fail();
    const name=statement.moduleSpecifier.text;
    imports.push(name);
    const clause=statement.importClause, bindings=clause?.namedBindings;
    if (name==='node:module') {
      if (clause?.name || !bindings || !ts.isNamedImports(bindings) || bindings.elements.length!==1) fail();
      const e=bindings.elements[0];
      if ((e.propertyName?.text ?? e.name.text)!=='createRequire') fail();
      requireNames.add(e.name.text);
    } else if (name==='node:process') {
      if (!clause?.name || bindings) fail();
    }
  }
  if (JSON.stringify(imports.sort())!==JSON.stringify(externals) || requireNames.size!==1) fail();
  let loads=0;
  const approvedFactoryCalls=new Set();
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isCallExpression(node.expression) && ts.isIdentifier(node.expression.expression) && requireNames.has(node.expression.expression.text)) {
      const inner=node.expression, url=inner.arguments[0];
      if (node.arguments.length!==1 || !ts.isStringLiteral(node.arguments[0]) || node.arguments[0].text!==addon || inner.arguments.length!==1 || !ts.isPropertyAccessExpression(url) || !ts.isMetaProperty(url.expression) || url.expression.keywordToken!==ts.SyntaxKind.ImportKeyword || url.name.text!=='url') fail();
      approvedFactoryCalls.add(inner);
      loads++;
    }
    if (ts.isIdentifier(node) && requireNames.has(node.text)) {
      const p=node.parent;
      const declaration=ts.isImportSpecifier(p) && (p.name===node || p.propertyName===node);
      const exactFactory=ts.isCallExpression(p) && p.expression===node && approvedFactoryCalls.has(p);
      if (!declaration && !exactFactory) fail();
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);
  if (loads!==1) fail();
}

async function compilerIdentity() {
  // Refuse native-binding overrides before loading the compiler. This is still
  // a trusted local build process, not isolation against malicious same-user code.
  if (Object.keys(process.env).some(k => k.startsWith('NAPI_RS_'))) fail();
  const packageName={
    'darwin-arm64':'@rolldown/binding-darwin-arm64',
    'darwin-x64':'@rolldown/binding-darwin-x64',
    'linux-x64':'@rolldown/binding-linux-x64-gnu',
  }[process.platform+'-'+process.arch];
  if (!packageName) fail();
  const files={
    recipe:fileURLToPath(import.meta.url),
    lock:path.join(toolRoot,'package-lock.json'),
    rolldownPackage:toolRequire.resolve('rolldown/package.json'),
    rolldownEntry:toolRequire.resolve('rolldown'),
    bindingPackage:toolRequire.resolve(packageName+'/package.json'),
    binding:toolRequire.resolve(packageName),
    typescriptPackage:toolRequire.resolve('typescript/package.json'),
    typescriptEntry:toolRequire.resolve('typescript'),
  };
  const hashes={};
  for (const [name,file] of Object.entries(files)) hashes[name]=hash(await fs.readFile(file));
  const version=JSON.parse(await fs.readFile(files.rolldownPackage,'utf8')).version;
  if (version!=='1.2.19' || JSON.parse(await fs.readFile(files.bindingPackage,'utf8')).version!==version || ts.version!=='5.9.3') fail();
  return {rolldown:version,typescript:ts.version,node:process.versions.node,platform:process.platform,architecture:process.arch,hashes};
}

export async function compileOperationalPrivateMain({sourceRoot}) {
  let bundle;
  try {
    const root=await fs.realpath(sourceRoot), rootStat=await fs.lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail();
    const captured=new Map();
    for (let i=0;i<members.length;i++) {
      const value=await sourceFile(root,prefix+members[i]);
      parsed(value.code);
      captured.set(ids[i],value);
    }
    const compiler=await compilerIdentity();
    const loaded=new Set();
    const {rolldown}=await import('rolldown');
    bundle=await rolldown({
      input:ids[0], platform:'neutral', tsconfig:false, treeshake:false,
      plugins:[{
        name:'fixed-operational-main-closure',
        resolveId(source,importer) {
          if (!importer && source===ids[0]) return source;
          if (!captured.has(importer)) fail();
          if (externals.includes(source) && importer===ids[0]) return {id:source,external:true};
          if (source==='server-only' && (importer===ids[1] || importer===ids[2])) return marker;
          const edges={
            [ids[0]]:{'./operationalNativePorts':ids[1],'./operationalSource':ids[2]},
            [ids[1]]:{},[ids[2]]:{},
          };
          const target=edges[importer]?.[source];
          if (!target) fail();
          return target;
        },
        load(id) {
          loaded.add(id);
          if (id===marker) return {code:'export {};',moduleType:'js'};
          if (!captured.has(id)) fail();
          return {code:captured.get(id).code,moduleType:'ts'};
        },
      }],
      onLog(level) { if (level==='warn' || level==='error') fail(); },
    });
    const result=await bundle.generate({format:'esm',entryFileNames:'main.mjs',codeSplitting:false,sourcemap:false,comments:false,minify:false});
    if (result.output.length!==1) fail();
    const output=result.output[0];
    if (output.type!=='chunk' || output.fileName!=='main.mjs' || !output.isEntry || output.isDynamicEntry || output.facadeModuleId!==ids[0] || output.map || output.sourcemapFileName || output.dynamicImports.length || JSON.stringify([...output.imports].sort())!==JSON.stringify(externals) || JSON.stringify(output.exports)!==JSON.stringify(['completion'])) fail();
    if ([...loaded].sort().join('|')!==[...ids,marker].sort().join('|')) fail();
    if (output.moduleIds.some(id=>!captured.has(id) && id!==marker) || ids.some(id=>!output.moduleIds.includes(id))) fail();
    checkCode(output.code,root);
    for (let i=0;i<members.length;i++) {
      const current=await sourceFile(root,prefix+members[i]), original=captured.get(ids[i]);
      if (current.signature!==original.signature || current.sha256!==original.sha256) fail();
    }
    if (directoryIdentity(await fs.lstat(root))!==directoryIdentity(rootStat) || JSON.stringify(await compilerIdentity())!==JSON.stringify(compiler)) fail();
    const sources=Object.fromEntries(members.map((name,i)=>[prefix+name,captured.get(ids[i]).sha256]));
    return {code:output.code,receipt:{format:1,scope:'closed-operational-supplier-source-capsule',sources,compiler,externals,output:{name:'main.mjs',bytes:Buffer.byteLength(output.code),sha256:hash(output.code)},serverOnlyMarker:'private-build-only-erased',targetExecuted:false,nativeQualified:false,administrativeLifecycleQualified:false,governanceEnabled:false}};
  } catch { return fail(); }
  finally { if (bundle) { try { await bundle.close(); } catch { fail(); } } }
}

export async function writeOperationalPrivateMain({sourceRoot,outputDirectory}) {
  try {
    const output=path.resolve(outputDirectory), parent=path.dirname(output);
    if (await fs.realpath(parent)!==parent) fail();
    await fs.mkdir(output,{mode:0o700}); // Exclusive directory, never recursive.
    const original=await fs.lstat(output);
    const current=async()=>{
      const now=await fs.lstat(output);
      if (!now.isDirectory() || now.isSymbolicLink() || directoryIdentity(now)!==directoryIdentity(original) || (now.mode&0o777)!==0o700) fail();
    };
    const {code,receipt}=await compileOperationalPrivateMain({sourceRoot});
    const written=new Map();
    for (const [name,bytes] of [['main.mjs',code],['SOURCE.json',JSON.stringify(receipt,null,2)+'\n']]) {
      await current();
      const file=await fs.open(path.join(output,name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);
      try {
        await file.writeFile(bytes); await file.sync();
        written.set(name,{bytes:Buffer.from(bytes),signature:signature(await file.stat({bigint:true}))});
      } finally { await file.close(); }
      await current();
    }
    if (JSON.stringify((await fs.readdir(output)).sort())!==JSON.stringify(['SOURCE.json','main.mjs'])) fail();
    for (const [name,originalFile] of written) {
      await current();
      const file=await fs.open(path.join(output,name),constants.O_RDONLY|constants.O_NOFOLLOW);
      try {
        const before=await file.stat({bigint:true});
        if (!before.isFile() || before.nlink!==1n || signature(before)!==originalFile.signature) fail();
        const bytes=Buffer.alloc(originalFile.bytes.length+1);
        const read=await file.read(bytes,0,bytes.length,0);
        const after=await file.stat({bigint:true});
        if (signature(after)!==originalFile.signature || read.bytesRead!==originalFile.bytes.length || !bytes.subarray(0,read.bytesRead).equals(originalFile.bytes)) fail();
      } finally { await file.close(); }
    }
    await current();
    return receipt;
  } catch { return fail(); }
}
