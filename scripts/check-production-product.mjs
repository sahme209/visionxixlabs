import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const ORIGIN='https://visionxixlabs.com';
const REPO='https://github.com/sahme209/axiom-releases';
const PLATFORMS={'mac-arm':['macos-arm','aarch64-apple-darwin'],'mac-intel':['macos-intel','x86_64-apple-darwin'],windows:['windows-x64','x86_64-pc-windows-msvc'],linux:['linux-x64','x86_64-unknown-linux-gnu']};
const MANUAL={googleSignIn:'UNVERIFIED',emailDelivery:'UNVERIFIED',nativePairing:'UNVERIFIED',installedApplicationJourney:'UNVERIFIED'};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const digest=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
function expected(tag,sha){return typeof tag==='string'&&tag.length<=64&&/^desktop-v\d+\.\d+\.\d+$/.test(tag)&&typeof sha==='string'&&/^[a-f0-9]{40}$/.test(sha);}
function assetUrl(value,tag,name){return typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/.test(name)&&name.trim()===name&&typeof value==='string'&&value===`${REPO}/releases/download/${tag}/${encodeURIComponent(name)}`;}
function result(failures,warnings=[]){return {automatedPass:failures.length===0,releaseAccepted:false,failures,warnings,manualGates:{...MANUAL},limits:['Public metadata/digests and redirect targets checked; installer bytes and signatures are not cryptographically verified.','Installer source SHA is not a website deployment SHA.','Provider availability is not successful authentication.']};}
/** Pure assessment of public responses. Never treats advertised providers as login proof. */
export function assessProductionProduct(input){
 const failures=[],warnings=[];const fail=code=>{if(!failures.includes(code))failures.push(code);};
 if(!object(input)||!expected(input.expectedTag,input.expectedSource))return result(['invalid_expected_release']);
 const {expectedTag:tag,expectedSource:sha,status,downloads,redirects,release,manifest,manifestDigest,manifestSize}=input;
 if(!object(status)||!Array.isArray(status.components)||status.components.length>100)fail('status_unavailable');
 else for(const id of ['autonomy_loop','outbound_channel','billing_plane']){const rows=status.components.filter(row=>object(row)&&row.id===id);if(rows.length!==1||!(id==='autonomy_loop'?['operational','degraded']:['operational']).includes(rows[0].verdict))fail('status_'+id+'_not_operational');else if(rows[0].verdict==='degraded')warnings.push('autonomy_quiet_or_degraded_not_proof_of_database_failure');}
 if(!object(release)||release.tag_name!==tag||release.draft!==false||release.prerelease!==false||release.html_url!==`${REPO}/releases/tag/${tag}`||!Array.isArray(release.assets)||release.assets.length>100)fail('public_release_mismatch');
 const gh=object(release)&&Array.isArray(release.assets)?release.assets:[];
 const manifestName=`Axiom-Agent-${tag}-candidate-manifest.json`,meta=gh.filter(a=>object(a)&&a.name===manifestName);
 if(meta.length!==1||!digest(meta[0].digest)||meta[0].digest!==manifestDigest||!Number.isSafeInteger(meta[0].size)||meta[0].size<=0||meta[0].size!==manifestSize||meta[0].size>524288||!assetUrl(meta[0].browser_download_url,tag,manifestName))fail('manifest_digest_or_metadata_mismatch');
 const manifestSignature=gh.filter(a=>object(a)&&a.name===manifestName+'.asc');if(manifestSignature.length!==1||!assetUrl(manifestSignature[0].browser_download_url,tag,manifestName+'.asc'))fail('manifest_signature_missing');
 if(!object(manifest)||manifest.schema!==1||manifest.sourceSha!==sha||manifest.releaseTag!==tag||manifest.version!==tag.slice(9)||typeof manifest.runId!=='string'||!/^[1-9][0-9]*$/.test(manifest.runId)||!Array.isArray(manifest.assets)||manifest.assets.length>100)fail('installer_source_or_run_mismatch');
 if(!object(manifest)||!Array.isArray(manifest.rawArtifacts)||manifest.rawArtifacts.length!==6||new Set(manifest.rawArtifacts.map(a=>a?.id)).size!==6||manifest.rawArtifacts.some(a=>!object(a)||a.sourceSha!==sha||a.runId!==manifest.runId||!Number.isSafeInteger(a.id)||a.id<=0||!digest(a.digest)))fail('candidate_run_binding_mismatch');
 const assets=object(manifest)&&Array.isArray(manifest.assets)?manifest.assets:[];
 for(const [platform,[kind,target]] of Object.entries(PLATFORMS)){
  const response=downloads?.[platform],a=response?.asset;
  if(!object(response)||response.status!=='available'||response.platform!==platform||response.version!==tag||response.releaseUrl!==`${REPO}/releases/tag/${tag}`||!object(a)||a.platform!==kind||!Number.isSafeInteger(a.sizeBytes)||a.sizeBytes<=0||!digest(a.digest)||!assetUrl(a.downloadUrl,tag,a.fileName)||!assetUrl(a.signatureUrl,tag,a.fileName+'.asc')){fail(platform+'_download_unavailable_or_invalid');continue;}
  if(redirects?.[platform]!==a.downloadUrl)fail(platform+'_redirect_mismatch');
  const published=gh.filter(x=>object(x)&&x.name===a.fileName),signed=gh.filter(x=>object(x)&&x.name===a.fileName+'.asc');
  if(published.length!==1||published[0].size!==a.sizeBytes||published[0].digest!==a.digest||published[0].browser_download_url!==a.downloadUrl||signed.length!==1||signed[0].browser_download_url!==a.signatureUrl)fail(platform+'_published_asset_mismatch');
  const bound=assets.filter(x=>object(x)&&x.fileName===a.fileName);if(bound.length!==1||bound[0].platform!==kind||bound[0].target!==target||bound[0].sizeBytes!==a.sizeBytes||'sha256:'+bound[0].sha256!==a.digest)fail(platform+'_candidate_asset_mismatch');
 }
 return result(failures,warnings);
}
async function bytes(response,cap){
 const header=response.headers.get('content-length');if(header!==null&&(!/^\d+$/.test(header)||Number(header)>cap))throw Error('bounded_response_required');
 if(!response.body)throw Error('body_required');const reader=response.body.getReader();let size=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>cap)throw Error('bounded_response_required');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 return Buffer.concat(chunks);
}
/** GET-only fixed-site smoke. Inject fetch in tests; no user-supplied origins/URLs.
 * @param {{expectedTag?: string, expectedSource?: string, fetchImpl?: typeof globalThis.fetch}} [options]
 */
export async function runProductionProductSmoke({expectedTag,expectedSource,fetchImpl=globalThis.fetch}={}){
 if(!expected(expectedTag,expectedSource))return result(['invalid_expected_release']);
 let stage='status',httpStatus=null;
 const get=async url=>{const response=await fetchImpl(url,{method:'GET',redirect:'manual',headers:{accept:'application/json'},signal:AbortSignal.timeout(8000)});httpStatus=response.status;return response;};
 const json=async(url,cap=1048576)=>{const response=await get(url);if(response.status!==200){await response.body?.cancel();throw Error('http_not_ok');}return JSON.parse((await bytes(response,cap)).toString('utf8'));};
 try{
  const status=await json(ORIGIN+'/api/status'),downloads={},redirects={};
  for(const platform of Object.keys(PLATFORMS)){
   stage='download_json_'+platform;downloads[platform]=await json(`${ORIGIN}/api/desktop/download?platform=${platform}&format=json`);
   stage='download_redirect_'+platform;const response=await fetchImpl(`${ORIGIN}/api/desktop/download?platform=${platform}`,{method:'GET',redirect:'manual',headers:{accept:'text/html'},signal:AbortSignal.timeout(8000)});
   httpStatus=response.status;await response.body?.cancel();if(response.status!==302)throw Error('download_redirect_required');redirects[platform]=response.headers.get('location');
  }
  stage='release_metadata';const release=await json(`https://api.github.com/repos/sahme209/axiom-releases/releases/tags/${expectedTag}`);
  stage='candidate_manifest';const name=`Axiom-Agent-${expectedTag}-candidate-manifest.json`;let url=`${REPO}/releases/download/${expectedTag}/${name}`,response;
  for(let hop=0;hop<3;hop++){
   response=await get(url);if(response.status===200)break;
   if(![301,302,303,307,308].includes(response.status))throw Error('manifest_http_not_ok');
   const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('manifest_redirect_required');const next=new URL(location,url);
   if(next.protocol!=='https:'||next.hostname!=='release-assets.githubusercontent.com'||next.port||next.username||next.password||next.hash)throw Error('manifest_redirect_refused');url=next.href;
  }
  if(response.status!==200)throw Error('manifest_redirect_limit');const raw=await bytes(response,524288),manifest=JSON.parse(raw.toString('utf8'));const assessment=assessProductionProduct({expectedTag,expectedSource,status,downloads,redirects,release,manifest,manifestDigest:'sha256:'+createHash('sha256').update(raw).digest('hex'),manifestSize:raw.length});
  return assessment;
 }catch{return {...result(['public_journey_request_or_response_failed']),failedStage:stage,httpStatus};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2);if(args.length!==2){console.error('Usage: node scripts/check-production-product.mjs desktop-vX.Y.Z INSTALLER_SOURCE_SHA');process.exitCode=1;}else{const report=await runProductionProductSmoke({expectedTag:args[0],expectedSource:args[1]});console.log(JSON.stringify(report,null,2));process.exitCode=report.automatedPass?0:1;}
}
