import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath, readdir, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const execute=promisify(execFile);
const defaultRun=async(file,args)=>{const {stdout,stderr}=await execute(file,args,{encoding:'utf8',timeout:60000,maxBuffer:1024*1024});return {stdout,stderr};};
async function hash(file){const digest=createHash('sha256');for await(const bytes of createReadStream(file))digest.update(bytes);return digest.digest('hex');}
function requireEvidence(condition,code){if(!condition)throw new Error(code);}
/** Verify the actual read-only mounted package. Injected commands are for fixtures only. */
export async function verifyPackagedMacos(input,{run=defaultRun,platform=process.platform}={}){
 requireEvidence(platform==='darwin','macos_verifier_requires_macos');
 requireEvidence(input.identifier==='com.visionxixlabs.axiom' && /^\d+\.\d+\.\d+$/.test(input.version) && /^[A-Z0-9]{10}$/.test(input.teamId) && ['arm64','x86_64'].includes(input.arch),'invalid_expected_package_identity');
 const file=path.resolve(input.dmg);const initial=await lstat(file);requireEvidence(initial.isFile()&&!initial.isSymbolicLink()&&initial.size>0&&file.endsWith('.dmg'),'invalid_dmg_file');const dmg=await realpath(file);const before=await hash(dmg);
 await run('/usr/bin/codesign',['--verify','--verbose=4',dmg]);
 const dmgSignature=await run('/usr/bin/codesign',['--display','--verbose=4',dmg]);
 const dmgDetails=dmgSignature.stdout+'\n'+dmgSignature.stderr;
 requireEvidence(new RegExp('(?:^|\\n)TeamIdentifier='+input.teamId+'(?:\\r?\\n|$)').test(dmgDetails)&&/^Authority=Developer ID Application:/m.test(dmgDetails)&&!/^Signature=adhoc/m.test(dmgDetails),'dmg_signing_identity_mismatch');
 await run('/usr/bin/xcrun',['stapler','validate',dmg]);await run('/usr/bin/hdiutil',['verify',dmg]);
 const owner=await realpath(await mkdtemp(path.join(tmpdir(),'axiom-packaged-mac-')));const mount=path.join(owner,'volume');await mkdir(mount,{mode:0o700});let attached=false;let detachConfirmed=false;let report;
 try{
  // Mark before dispatch: even a failed attach may leave a mounted volume.
  attached=true;await run('/usr/bin/hdiutil',['attach','-readonly','-nobrowse','-mountpoint',mount,dmg]);
  const entries=(await readdir(mount,{withFileTypes:true})).filter(entry=>entry.name.endsWith('.app'));
  requireEvidence(entries.length===1&&entries[0].isDirectory()&&!entries[0].isSymbolicLink(),'packaged_app_missing_or_ambiguous');const app=path.join(mount,entries[0].name);requireEvidence((await realpath(app))===app,'packaged_app_symlink');const plist=path.join(app,'Contents','Info.plist');
  const read=async key=>(await run('/usr/libexec/PlistBuddy',['-c','Print :'+key,plist])).stdout.trim();
  requireEvidence(await read('CFBundleIdentifier')===input.identifier,'packaged_identifier_mismatch');requireEvidence(await read('CFBundleShortVersionString')===input.version,'packaged_version_mismatch');const executable=await read('CFBundleExecutable');requireEvidence(/^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(executable)&&!['.','..'].includes(executable),'invalid_packaged_executable');const binary=path.join(app,'Contents','MacOS',executable);requireEvidence((await realpath(binary))===binary && (await lstat(binary)).isFile(),'packaged_binary_symlink');
  const architectures=(await run('/usr/bin/lipo',['-archs',binary])).stdout.trim().split(/\s+/);requireEvidence(architectures.includes(input.arch),'packaged_architecture_mismatch');
  await run('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=4',app]);const signature=await run('/usr/bin/codesign',['--display','--verbose=4',app]);const details=signature.stdout+'\n'+signature.stderr;requireEvidence(new RegExp('(?:^|\\n)TeamIdentifier='+input.teamId+'(?:\\r?\\n|$)').test(details)&&/^Authority=Developer ID Application:/m.test(details)&&!/^Signature=adhoc/m.test(details),'packaged_signing_identity_mismatch');
  const assessment=await run('/usr/sbin/spctl',['--assess','--type','execute','--verbose=4',app]);requireEvidence(/^source=Notarized Developer ID\s*$/m.test(assessment.stdout+'\n'+assessment.stderr),'packaged_gatekeeper_notarization_missing');await run('/usr/bin/xcrun',['stapler','validate',app]);
  requireEvidence(await hash(dmg)===before,'dmg_changed_during_verification');report={schema:1,fileName:path.basename(dmg),sizeBytes:initial.size,sha256:before,identifier:input.identifier,version:input.version,teamId:input.teamId,architecture:input.arch,artifactSigned:true,artifactNotarized:true};
 }finally{
  if(attached){await run('/usr/bin/hdiutil',['detach',mount]);detachConfirmed=true;}
  if(!attached||detachConfirmed)await rm(owner,{recursive:true,force:true});
 }
 requireEvidence(detachConfirmed,'packaged_volume_cleanup_unconfirmed');requireEvidence(await hash(dmg)===before,'dmg_changed_during_cleanup');return {...report,mountedReadOnly:true,volumeDetached:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [dmg,version,teamId,arch]=process.argv.slice(2);try{const result=await verifyPackagedMacos({dmg,version,teamId,arch,identifier:'com.visionxixlabs.axiom'});console.log(JSON.stringify(result));}catch(error){console.error('Packaged macOS verification failed:',error instanceof Error?error.message:'unknown_error');process.exitCode=1;}
}
