import {readFileSync,openSync,closeSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const[draftFile,dir]=process.argv.slice(2),draft=JSON.parse(readFileSync(draftFile));
// The preceding draft guard validates the entire list before any download.
for(const asset of draft.assets){
 if(!Number.isSafeInteger(asset.id)||asset.id<=0||typeof asset.name!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._ -]{0,203}$/.test(asset.name)||asset.name!==asset.name.trim())throw Error('Unsafe download identity');
 const file=join(dir,asset.name),fd=openSync(file,'wx',0o600);
 try{execFileSync('gh',['api',`repos/sahme209/axiom-releases/releases/assets/${asset.id}`,'-H','Accept: application/octet-stream'],{stdio:['ignore',fd,'pipe'],timeout:120000})}finally{closeSync(fd)}
 if(lstatSync(file).size!==asset.size||'sha256:'+createHash('sha256').update(readFileSync(file)).digest('hex')!==asset.digest)throw Error('Downloaded asset differs');
}
