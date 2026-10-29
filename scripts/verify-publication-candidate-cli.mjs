import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyPublicationCandidate} from './verify-publication-candidate.mjs';
const fingerprint=process.env.EXPECTED_GPG_FINGERPRINT;
if(!/^[A-F0-9]{40}$/.test(fingerprint??''))throw Error('Pinned public key fingerprint required');
const home=mkdtempSync(join(tmpdir(),'axiom-public-key-'));
try{
 const key=process.env.PUBLIC_KEY_PATH??'axiom-public-key.asc';
 const listing=execFileSync('gpg',['--batch','--with-colons','--show-keys',key],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const primaries=listing.split('\n').filter(l=>l.startsWith('pub:'));const first=listing.split('\n').find(l=>l.startsWith('fpr:'))?.split(':')[9];
 if(primaries.length!==1||first!==fingerprint)throw Error('Public key changed');
 execFileSync('gpg',['--homedir',home,'--batch','--import',key],{stdio:'pipe'});
 const expected={releaseTag:process.env.RELEASE_TAG,sourceSha:process.env.SOURCE_SHA,runId:process.env.CANDIDATE_RUN_ID,manifestSha256:process.env.MANIFEST_SHA256};
 const manifest=verifyPublicationCandidate({dir:process.env.CANDIDATE_DIR??'candidate',expected,verifySignature:(file,signature)=>{
  const status=execFileSync('gpg',['--homedir',home,'--batch','--status-fd','1','--verify',signature,file],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  return status.split('\n').some(l=>{const a=l.split(' ');return a[0]==='[GNUPG:]'&&a[1]==='VALIDSIG'&&(a[2]===fingerprint||a.at(-1)===fingerprint)});
 }});
 process.stdout.write(JSON.stringify({sourceSha:manifest.sourceSha,releaseTag:manifest.releaseTag,runId:manifest.runId,assets:manifest.assets.map(a=>({name:a.fileName,sha256:a.sha256,sizeBytes:a.sizeBytes}))})+'\n');
}finally{rmSync(home,{recursive:true,force:true})}
