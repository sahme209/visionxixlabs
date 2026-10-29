import {test} from 'node:test';import assert from 'node:assert/strict';import {execFileSync,spawnSync} from 'node:child_process';import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
test('actual isolated GPG CLI accepts reviewed signatures and refuses modified signature',()=>{
 const root=mkdtempSync(join(tmpdir(),'axiom-gpg-test-')),home=join(root,'key'),dir=join(root,'candidate');mkdirSync(home,{mode:0o700});mkdirSync(dir);const sha=b=>createHash('sha256').update(b).digest('hex');
 try{
  execFileSync('gpg',['--homedir',home,'--batch','--passphrase','','--quick-generate-key','Axiom disposable fixture <fixture@example.invalid>','ed25519','sign','1d'],{stdio:'pipe'});
  const listing=execFileSync('gpg',['--homedir',home,'--with-colons','--list-keys'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}),fingerprint=listing.split('\n').find(l=>l.startsWith('fpr:')).split(':')[9];
  const publicKey=join(root,'public.asc');writeFileSync(publicKey,execFileSync('gpg',['--homedir',home,'--armor','--export',fingerprint]));
  const platforms={'macos-arm':['aarch64-apple-darwin','arm.dmg'],'macos-intel':['x86_64-apple-darwin','intel.dmg'],'windows-x64':['x86_64-pc-windows-msvc','windows.exe'],'linux-x64':['x86_64-unknown-linux-gnu','linux.deb'],sbom:['source','sbom.cdx.json']};
  const assets=Object.entries(platforms).map(([platform,[target,suffix]])=>{const fileName=platform==='sbom'?'Axiom-Agent-desktop-v0.1.21-sbom.cdx.json':`Axiom_0.1.21_${suffix}`,bytes=Buffer.from(platform);writeFileSync(join(dir,fileName),bytes);return{platform,target,fileName,sizeBytes:bytes.length,sha256:sha(bytes)}});
  const name='Axiom-Agent-desktop-v0.1.21-candidate-manifest.json',raw=JSON.stringify({schema:1,sourceSha:'a'.repeat(40),releaseTag:'desktop-v0.1.21',version:'0.1.21',runId:'123',assets});writeFileSync(join(dir,name),raw);
  for(const file of [...assets.map(a=>a.fileName),name])execFileSync('gpg',['--homedir',home,'--batch','--armor','--detach-sign',join(dir,file)],{stdio:'pipe'});
  const env={...process.env,EXPECTED_GPG_FINGERPRINT:fingerprint,PUBLIC_KEY_PATH:publicKey,CANDIDATE_DIR:dir,RELEASE_TAG:'desktop-v0.1.21',SOURCE_SHA:'a'.repeat(40),CANDIDATE_RUN_ID:'123',MANIFEST_SHA256:sha(raw)};
  const cli=new URL('../verify-publication-candidate-cli.mjs',import.meta.url).pathname;
  let result=spawnSync(process.execPath,[cli],{env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).assets.length,5);
  writeFileSync(join(dir,assets[0].fileName+'.asc'),'invalid signature');result=spawnSync(process.execPath,[cli],{env,encoding:'utf8'});assert.notEqual(result.status,0);
  result=spawnSync(process.execPath,[cli],{env:{...env,EXPECTED_GPG_FINGERPRINT:'B'.repeat(40)},encoding:'utf8'});assert.notEqual(result.status,0);
 }finally{rmSync(root,{recursive:true,force:true})}
});
