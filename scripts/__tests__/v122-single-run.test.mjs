import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const workflow=readFileSync(new URL('../../.github/workflows/desktop-release.yml',import.meta.url),'utf8');
test('one tag export is exact-source bounded and stable publication remains dispatch-only',()=>{
 const boundary="github.event_name == 'push' && github.ref == 'refs/tags/desktop-v0.1.22' && github.sha == vars.AXIOM_DESKTOP_DRAFT_EXPORT_SOURCE && vars.AXIOM_DESKTOP_DRAFT_EXPORT_READY == 'true'";
 assert.equal(workflow.split(boundary).length-1,2);
 const publication=workflow.split('\n  publish:')[1].split('\n  export-fixed-candidate:')[0];assert.match(publication,/if: github.event_name == 'workflow_dispatch'/);
 const draft=workflow.split('\n  export-draft:')[1].split('\n  publish:')[0];assert.match(draft,/timeout-minutes: 5/);assert.doesNotMatch(draft,/draft=false/);
});
const source=workflow.split('- name: Validate and flatten candidate artifacts')[1].split("node <<'NODE'\n")[1].split('\n          NODE')[0].replace(/^          /gm,'');
function flatten(collide=false){const cwd=mkdtempSync(join(tmpdir(),'axiom-filenames-'));const sha='a'.repeat(40),run='123',version='0.1.22';const targets={'macos-arm':'aarch64-apple-darwin','macos-intel':'x86_64-apple-darwin','windows-x64':'x86_64-pc-windows-msvc','linux-x64':'x86_64-unknown-linux-gnu',sbom:'source'};const names={'macos-arm':'Axiom Agent_0.1.22_arm.dmg','macos-intel':'Axiom Agent_0.1.22_intel.dmg','windows-x64':'Axiom Agent_0.1.22_x64.msi','linux-x64':'Axiom Agent_0.1.22_x64.AppImage',sbom:'axiom-agent.sbom.cdx.json'};const artifacts=['axiom-macos-arm','axiom-macos-intel','axiom-windows-x64','axiom-linux-x64','axiom-sbom','axiom-sbom-provenance'].map((name,i)=>({name,id:i+1,expired:false,digest:'sha256:'+'b'.repeat(64),workflow_run:{id:123,head_sha:sha}}));writeFileSync(join(cwd,'candidate-artifacts.json'),JSON.stringify({total_count:6,artifacts}));
 for(const [platform,target] of Object.entries(targets)){const dir=join(cwd,'artifacts',platform);mkdirSync(dir,{recursive:true});const fileName=names[platform],bytes=Buffer.from('unchanged '+platform);writeFileSync(join(dir,fileName),bytes);const asset={fileName,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};const assets=[asset];if(collide&&platform==='macos-arm'){const second={...asset,fileName:fileName.replaceAll(' ','.')};writeFileSync(join(dir,second.fileName),bytes);assets.push(second);}writeFileSync(join(dir,`candidate-${platform}.json`),JSON.stringify({schema:1,sourceSha:sha,releaseTag:'desktop-v'+version,version,runId:run,platform,target,assets}));if(platform!=='sbom')writeFileSync(join(dir,`release-attestation-${platform}.env`),`platform=${platform}\nartifact_signed=false\nartifact_notarized=false\n`);}
 const result=spawnSync(process.execPath,['-e',source],{cwd,encoding:'utf8',env:{...process.env,SOURCE_SHA:sha,RELEASE_TAG:'desktop-v'+version,VERSION:version,CANDIDATE_RUN_ID:run}});try{if(!collide){assert.equal(result.status,0,result.stderr);const manifest=JSON.parse(readFileSync(join(cwd,'flat','Axiom-Agent-desktop-v0.1.22-candidate-manifest.json')));assert.ok(manifest.assets.every(a=>!a.fileName.includes(' ')));for(const asset of manifest.assets){const bytes=readFileSync(join(cwd,'flat',asset.fileName));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}}else{assert.notEqual(result.status,0);assert.match(result.stderr,/Normalized candidate filename collision/);}}finally{rmSync(cwd,{recursive:true,force:true});}}
test('actual candidate flattening normalizes names without changing bytes',()=>flatten());
test('actual candidate flattening refuses collisions introduced by normalization',()=>flatten(true));
