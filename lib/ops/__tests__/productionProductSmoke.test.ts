import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {assessProductionProduct,runProductionProductSmoke} from '../../../scripts/check-production-product.mjs';
const tag='desktop-v0.1.24',source='a'.repeat(40),repo='https://github.com/sahme209/axiom-releases';
const url=(name:string)=>`${repo}/releases/download/${tag}/${encodeURIComponent(name)}`;
function fixture(){
 const downloads:Record<string,any>={},redirects:Record<string,string>={},assets:any[]=[],published:any[]=[];
 for(const [platform,kind,target,ext] of [['mac-arm','macos-arm','aarch64-apple-darwin','dmg'],['mac-intel','macos-intel','x86_64-apple-darwin','dmg'],['windows','windows-x64','x86_64-pc-windows-msvc','msi'],['linux','linux-x64','x86_64-unknown-linux-gnu','AppImage']]){
  const fileName=`V19_0.1.24_${kind}.${ext}`,sha256='b'.repeat(64),sizeBytes=123;
  const asset={platform:kind,fileName,downloadUrl:url(fileName),sizeBytes,digest:'sha256:'+sha256,signatureUrl:url(fileName+'.asc'),signed:false,notarized:false};
  downloads[platform]={status:'available',platform,version:tag,releaseUrl:`${repo}/releases/tag/${tag}`,asset};redirects[platform]=asset.downloadUrl;
  assets.push({platform:kind,target,fileName,sizeBytes,sha256});published.push({name:fileName,size:sizeBytes,digest:asset.digest,browser_download_url:asset.downloadUrl},{name:fileName+'.asc',browser_download_url:asset.signatureUrl});
 }
 const manifest={schema:1,sourceSha:source,releaseTag:tag,version:'0.1.24',runId:'123',rawArtifacts:Array.from({length:6},(_,i)=>({id:i+1,runId:'123',sourceSha:source,digest:'sha256:'+'c'.repeat(64)})),assets};
 const raw=JSON.stringify(manifest),manifestDigest='sha256:'+createHash('sha256').update(raw).digest('hex'),name=`Axiom-Agent-${tag}-candidate-manifest.json`;
 published.push({name,size:Buffer.byteLength(raw),digest:manifestDigest,browser_download_url:url(name)},{name:name+'.asc',browser_download_url:url(name+'.asc')});
 return {expectedTag:tag,expectedSource:source,status:{components:['autonomy_loop','outbound_channel','billing_plane'].map(id=>({id,verdict:'operational'}))},downloads,redirects,release:{tag_name:tag,draft:false,prerelease:false,html_url:`${repo}/releases/tag/${tag}`,assets:published},manifest,manifestDigest,manifestSize:Buffer.byteLength(raw)};
}
function transport(data=fixture(),mode=''){
 const calls:string[]=[];
 const fetchImpl=async(input:any,options?:RequestInit)=>{
  const target=String(input);calls.push(target);expect(options?.method).toBe('GET');expect(options?.redirect).toBe('manual');
  if(target==='https://visionxixlabs.com/api/status')return new Response(mode==='bad-json'?'not-json':JSON.stringify(data.status),{status:mode==='503'?503:200});
  if(target.startsWith('https://visionxixlabs.com/api/desktop/download?')){
   const request=new URL(target),platform=request.searchParams.get('platform')!;
   if(request.searchParams.get('format')==='json')return Response.json(data.downloads[platform]);
   return new Response(null,{status:302,headers:{location:data.redirects[platform]}});
  }
  if(target===`https://api.github.com/repos/sahme209/axiom-releases/releases/tags/${tag}`)return Response.json(data.release);
  if(target===url(`Axiom-Agent-${tag}-candidate-manifest.json`)){
   if(mode==='evil-redirect')return new Response(null,{status:302,headers:{location:'https://attacker.invalid/secret'}});
   if(mode==='large-manifest')return new Response('{}',{headers:{'content-length':'524289'}});
   return new Response(JSON.stringify(data.manifest));
  }
  throw Error('unexpected outbound request');
 };
 return {fetchImpl,calls};
}
describe('public critical-product smoke',()=>{
 it('keeps real authentication/email/native gates unverified even when every public response passes',async()=>{
  const t=transport(),report=await runProductionProductSmoke({expectedTag:tag,expectedSource:source,fetchImpl:t.fetchImpl});
  expect(report.automatedPass).toBe(true);expect(report.releaseAccepted).toBe(false);expect(Object.values(report.manualGates)).toEqual(Array(4).fill('UNVERIFIED'));expect(t.calls).toHaveLength(11);
  expect(t.calls.every(s=>s.startsWith('https://visionxixlabs.com/')||s.startsWith('https://api.github.com/repos/sahme209/axiom-releases/')||s.startsWith(repo+'/releases/download/'))).toBe(true);
 });
 it('allows quiet disabled Governance without treating it as failed storage or enabling it',()=>{
  const d=fixture();d.status.components[0].verdict='degraded';const result=assessProductionProduct(d);expect(result.automatedPass).toBe(true);expect(result.warnings).toEqual(['autonomy_quiet_or_degraded_not_proof_of_database_failure']);expect(result.releaseAccepted).toBe(false);
 });
 it.each([
  (d:any)=>{d.status.components[0].verdict='unknown';},(d:any)=>{d.status.components[1].verdict='down';},(d:any)=>{d.status.components[2].verdict='unknown';},
  (d:any)=>{d.status.components.push(d.status.components[2]);},(d:any)=>{d.downloads.windows.status='temporarily_unavailable';},(d:any)=>{d.downloads.linux.version='desktop-v0.1.21';},
  (d:any)=>{d.downloads.windows.asset.digest=null;},(d:any)=>{d.downloads.windows.asset.sizeBytes=0;},(d:any)=>{d.downloads.windows.asset.signatureUrl=null;},
  (d:any)=>{d.downloads.windows.asset.downloadUrl='https://attacker.invalid/app.exe';},(d:any)=>{d.redirects.windows='https://attacker.invalid/app.exe';},
  (d:any)=>{d.manifest.sourceSha='d'.repeat(40);},(d:any)=>{d.manifest.runId='0';},(d:any)=>{d.manifest.rawArtifacts[0].runId='456';},(d:any)=>{d.manifest.rawArtifacts[1].id=d.manifest.rawArtifacts[0].id;},
  (d:any)=>{d.manifest.assets[0].sha256='d'.repeat(64);},(d:any)=>{d.manifestDigest='sha256:'+'e'.repeat(64);},(d:any)=>{d.manifestSize=1;},
  (d:any)=>{d.release.draft=true;},(d:any)=>{d.release.assets.pop();},
 ])('refuses broken storage/download/source/digest/signature/redirect evidence',mutate=>{const d=fixture();mutate(d);const r=assessProductionProduct(d);expect(r.automatedPass).toBe(false);expect(r.releaseAccepted).toBe(false);});
 it.each(['503','bad-json','evil-redirect','large-manifest'])('fails bounded GET-only collection on %s without fetching untrusted destinations',async mode=>{
  const t=transport(fixture(),mode);const r=await runProductionProductSmoke({expectedTag:tag,expectedSource:source,fetchImpl:t.fetchImpl});expect(r.automatedPass).toBe(false);expect(t.calls.some(s=>s.includes('attacker.invalid'))).toBe(false);
 });
 it('rejects arbitrary origins or invalid release inputs before any request',async()=>{
  const t=transport();expect((await runProductionProductSmoke({expectedTag:'https://localhost/',expectedSource:source,fetchImpl:t.fetchImpl})).automatedPass).toBe(false);expect(t.calls).toEqual([]);
 });
});
