import {readFileSync,lstatSync,readdirSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const targets={'macos-arm':'aarch64-apple-darwin','macos-intel':'x86_64-apple-darwin','windows-x64':'x86_64-pc-windows-msvc','linux-x64':'x86_64-unknown-linux-gnu',sbom:'source'};
const extensions={'macos-arm':/\.dmg$/,'macos-intel':/\.dmg$/,'windows-x64':/\.(exe|msi)$/,'linux-x64':/\.(deb|rpm|AppImage)$/,'sbom':/-sbom\.cdx\.json$/};
/** Verifies a frozen draft against independently reviewed identity and manifest hash.
 * Signature verification must use the pinned public key in an isolated keyring.
 * This reader never uploads, publishes, edits tags, or handles private signing keys. */
export function verifyPublicationCandidate({dir,expected,verifySignature}){
 if(!expected||!/^desktop-v\d+\.\d+\.\d+$/.test(expected.releaseTag)||!/^\d+$/.test(expected.runId)||! /^[a-f0-9]{40}$/.test(expected.sourceSha)||! /^[a-f0-9]{64}$/.test(expected.manifestSha256)||typeof verifySignature!=='function')throw Error('Reviewed identity required');
 const version=expected.releaseTag.slice('desktop-v'.length),manifestName=`Axiom-Agent-${expected.releaseTag}-candidate-manifest.json`,names=new Set([manifestName,manifestName+'.asc']);
 function bytes(name){if(typeof name!=='string'||basename(name)!==name||! /^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/.test(name)||name!==name.trim())throw Error('Unsafe asset name');const file=join(dir,name),stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size<=0||stat.size>2*1024**3)throw Error('Invalid asset file');return readFileSync(file)}
 const raw=bytes(manifestName);if(hash(raw)!==expected.manifestSha256)throw Error('Reviewed manifest changed');
 if(verifySignature(join(dir,manifestName),join(dir,manifestName+'.asc'))!==true)throw Error('Manifest signature refused');
 const manifest=JSON.parse(raw);
 if(manifest.schema!==1||manifest.version!==version||manifest.releaseTag!==expected.releaseTag||manifest.sourceSha!==expected.sourceSha||manifest.runId!==expected.runId||!Array.isArray(manifest.assets)||manifest.assets.length<5||manifest.assets.length>30)throw Error('Candidate identity changed');
 const platforms=new Set();
 for(const asset of manifest.assets){if(!Object.hasOwn(targets,asset.platform)||asset.target!==targets[asset.platform]||!extensions[asset.platform].test(asset.fileName)||names.has(asset.fileName)||names.has(asset.fileName+'.asc')||!Number.isSafeInteger(asset.sizeBytes)||asset.sizeBytes<=0||! /^[a-f0-9]{64}$/.test(asset.sha256))throw Error('Invalid candidate asset');
  if(asset.platform!=='sbom'&&!asset.fileName.split(/[^0-9.]+/).includes(version))throw Error('Installer version changed');
  const raw=bytes(asset.fileName);bytes(asset.fileName+'.asc');if(raw.length!==asset.sizeBytes||hash(raw)!==asset.sha256)throw Error('Installer bytes changed');
  if(verifySignature(join(dir,asset.fileName),join(dir,asset.fileName+'.asc'))!==true)throw Error('Installer signature refused');names.add(asset.fileName);names.add(asset.fileName+'.asc');platforms.add(asset.platform);
 }
 if(platforms.size!==5||Object.keys(targets).some(p=>!platforms.has(p)))throw Error('Missing platform');
 const actual=readdirSync(dir);if(actual.length!==names.size||actual.some(n=>!names.has(n)))throw Error('Unexpected payload');
 return structuredClone(manifest);
}
