import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,realpath,open} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {dirname} from 'node:path';
import {customerHostedAttestedHold} from './customerHostedLimitEvidence';
const exec=promisify(execFile);
const ROOT='/Library/Application Support/VisionXIXLabs/Axiom/OfflineModelAcceptance';
type Config={readonly digest:string;readonly models:readonly {readonly id:string;readonly maxInputTokens:number;readonly maxOutputTokens:number}[]};
function fail():never{throw Error('customer_hosted_model_acceptance_unavailable')}
export function customerHostedAcceptancePath(configDigest:string,modelId:string):string {
 if(!/^[a-f0-9]{64}$/.test(configDigest)||!modelId||modelId.length>200)fail();
 return ROOT+'/acceptance-'+createHash('sha256').update(JSON.stringify([configDigest,modelId])).digest('hex')+'.json';
}
/** Conservative macOS no-ACL profile. Metadata parsing is not a substitute for
 * owner/mode/inode checks; unsupported platforms/profiles refuse. No calls occur
 * merely by importing this module. Local tests inject synthetic protected IO. */
export function customerHostedNoAclListing(text:string):boolean {
 const lines=text.trim().split('\n');
 return lines.length===1&&/^[d-][rwxStTs-]{9}@?\s/.test(lines[0]);
}
export function customerHostedProtectedStat(stat:{uid:number;mode:number;isSymbolicLink():boolean;isFile():boolean;isDirectory():boolean},file:boolean):boolean {
 return !stat.isSymbolicLink()&&stat.uid===0&&(stat.mode&0o022)===0&&(file?stat.isFile():stat.isDirectory());
}
async function readProtected(path:string):Promise<Buffer>{
 if(process.platform!=='darwin'||!path.startsWith(ROOT+'/')||!/^((acceptance-)?[a-f0-9]{64})\.json$/.test(path.slice(ROOT.length+1)))fail();
 // All parents must be root-owned, not symlinks, not writable by group/others
 // and without an ACL granting access outside the mode-bit profile.
 const parents:string[]=[];for(let p=dirname(path);;p=dirname(p)){parents.push(p);if(p==='/')break}
 for(const p of [...parents.reverse(),path]){
  const st=await lstat(p);
  if(!customerHostedProtectedStat(st,p===path))fail();
  if(await realpath(p)!==p)fail();
  const {stdout}=await exec('/bin/ls',['-lde','--',p],{env:{PATH:'/usr/bin:/bin',LC_ALL:'C',NODE_ENV:'production'},timeout:2000,maxBuffer:8192});
  if(!customerHostedNoAclListing(stdout))fail();
 }
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const before=await file.stat({bigint:true});
  if(before.uid!==BigInt(0)||(before.mode&BigInt(0o022))!==BigInt(0)||!before.isFile()||before.size<BigInt(1)||before.size>BigInt(16384))fail();
  const bytes=Buffer.alloc(Number(before.size)+1),read=await file.read(bytes,0,bytes.length,0),after=await file.stat({bigint:true});
  if(read.bytesRead!==Number(before.size)||before.ino!==after.ino||before.dev!==after.dev||before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs)fail();
  return bytes.subarray(0,read.bytesRead);
 }finally{await file.close()}
}
function record(bytes:Buffer,keys:readonly string[]):Record<string,unknown>{
 if(bytes.length>16384)fail();const v:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!v||typeof v!=='object'||Array.isArray(v))fail();
 const row=v as Record<string,unknown>;if(Object.keys(row).length!==keys.length||Object.keys(row).some(k=>!keys.includes(k)))fail();return row;
}
/** Root-protected records carry the deployment operator's reviewed acceptance,
 * not cryptographic proof of server behavior. Hashes bind the reviewed bytes;
 * actual isolated-model observation is a separate required operator action. */
export async function readAcceptedCustomerHostedLimits(config:Config,modelId:string,now:number,read:(path:string)=>Promise<Buffer>=readProtected):Promise<{reservedTokens:number;expiresAt:number;evidenceSha256:string}|null>{
 try{
  const accepted=record(await read(customerHostedAcceptancePath(config.digest,modelId)),['format','configDigest','modelId','maxInputTokens','maxOutputTokens','expiresAt','evidenceSha256','operatorReviewedAt']);
  const {operatorReviewedAt,...attestation}=accepted;
  const reservedTokens=customerHostedAttestedHold(config,modelId,JSON.stringify(attestation),now);
  if(reservedTokens===null||typeof accepted.evidenceSha256!=='string'||typeof operatorReviewedAt!=='string')return null;
  const reviewed=Date.parse(operatorReviewedAt);if(!Number.isSafeInteger(reviewed)||reviewed<0||reviewed>now||new Date(reviewed).toISOString()!==operatorReviewedAt)return null;
  const evidenceBytes=await read(ROOT+'/'+accepted.evidenceSha256+'.json');
  if(createHash('sha256').update(evidenceBytes).digest('hex')!==accepted.evidenceSha256)return null;
  const evidence=record(evidenceBytes,['format','configDigest','modelId','maxInputTokens','maxOutputTokens','inputLimitEnforced','outputLimitEnforced','usageVerified','observedAt']);
  if(evidence.format!=='axiom.isolated-model-limits/1'||evidence.configDigest!==config.digest||evidence.modelId!==modelId||evidence.maxInputTokens!==accepted.maxInputTokens||evidence.maxOutputTokens!==accepted.maxOutputTokens||evidence.inputLimitEnforced!==true||evidence.outputLimitEnforced!==true||evidence.usageVerified!==true||typeof evidence.observedAt!=='string')return null;
  const observed=Date.parse(evidence.observedAt);if(!Number.isSafeInteger(observed)||observed<0||observed>reviewed||new Date(observed).toISOString()!==evidence.observedAt)return null;
  return Object.freeze({reservedTokens,expiresAt:Date.parse(accepted.expiresAt as string),evidenceSha256:accepted.evidenceSha256});
 }catch{return null;}
}
