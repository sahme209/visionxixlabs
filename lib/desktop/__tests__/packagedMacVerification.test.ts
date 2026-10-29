import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,realpath,mkdir,writeFile,appendFile,symlink,rm,stat,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {verifyPackagedMacos} from '../../../scripts/verify-packaged-macos.mjs';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(overrides:Record<string,unknown>={}){
 const root=await realpath(await mkdtemp(path.join(tmpdir(),'axiom-package-fixture-')));roots.push(root);const dmg=path.join(root,'Axiom_0.1.21.dmg');await writeFile(dmg,'synthetic package bytes, not a real signed image');
 const values:Record<string,unknown>={identifier:'com.visionxixlabs.axiom',version:'0.1.21',executable:'axiom-desktop',arch:'arm64',signature:'Authority=Developer ID Application: Fixture (ABCDE12345)\nTeamIdentifier=ABCDE12345\n',assessment:'accepted\nsource=Notarized Developer ID\n',...overrides};let mounted='';
 const run=vi.fn(async(file:string,args:string[])=>{
  if(file.endsWith('hdiutil')&&args[0]==='attach'){
   mounted=args[args.indexOf('-mountpoint')+1];const app=path.join(mounted,'Axiom Agent.app');await mkdir(path.join(app,'Contents','MacOS'),{recursive:true});await writeFile(path.join(app,'Contents','MacOS','axiom-desktop'),'synthetic binary');
   if(values.extraApp)await mkdir(path.join(mounted,'Other.app'));
   if(values.symlinkBinary){const binary=path.join(app,'Contents','MacOS','axiom-desktop');const outside=path.join(root,'outside');await writeFile(outside,'synthetic');await rm(binary);await symlink(outside,binary);}
   if(values.symlinkApp){const outside=path.join(root,'outside.app');await rename(app,outside);await symlink(outside,app);}
  }
  if(values.failCommand===file+':'+args[0] && !(file.endsWith('xcrun')&&args.at(-1)===dmg))throw Error('synthetic verifier failure');
  if(file.endsWith('PlistBuddy'))return {stdout:args[1].includes('CFBundleIdentifier')?String(values.identifier):args[1].includes('CFBundleShortVersionString')?String(values.version):String(values.executable),stderr:''};
  if(file.endsWith('lipo'))return {stdout:String(values.arch),stderr:''};
  if(file.endsWith('codesign')&&args[0]==='--display')return {stdout:'',stderr:String(args.at(-1)===dmg?'Authority=Developer ID Application: Fixture (ABCDE12345)\nTeamIdentifier=ABCDE12345\n':values.signature)};
  if(file.endsWith('spctl')){if(values.tamper)await appendFile(dmg,'changed');return {stdout:'',stderr:String(values.assessment)};}
  if(file.endsWith('hdiutil')&&args[0]==='detach'&&values.tamperDuringDetach)await appendFile(dmg,'changed during detach');
  return {stdout:'',stderr:''};
 });
 const verify=()=>verifyPackagedMacos({dmg,version:'0.1.21',teamId:'ABCDE12345',arch:'arm64',identifier:'com.visionxixlabs.axiom'},{run,platform:'darwin'});
 return {root,dmg,run,verify,mounted:()=>mounted};
}
it('accepts only complete simulated package evidence and detaches the read-only mount',async()=>{
 const f=await fixture();const r=await f.verify();expect(r).toMatchObject({artifactSigned:true,artifactNotarized:true,mountedReadOnly:true,volumeDetached:true,version:'0.1.21',architecture:'arm64'});expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);expect(f.run).toHaveBeenCalledWith('/usr/bin/hdiutil',expect.arrayContaining(['attach','-readonly','-nobrowse']));expect(f.run).toHaveBeenCalledWith('/usr/bin/hdiutil',['detach',f.mounted()]);await expect(stat(path.dirname(f.mounted()))).rejects.toThrow();
});
it.each([
 [{identifier:'other.app'},'packaged_identifier_mismatch'],[{version:'0.1.20'},'packaged_version_mismatch'],[{arch:'x86_64'},'packaged_architecture_mismatch'],[{executable:'../../outside'},'invalid_packaged_executable'],[{signature:'Signature=adhoc\nTeamIdentifier=ABCDE12345\n'},'packaged_signing_identity_mismatch'],[{signature:'Authority=Developer ID Application: Other\nTeamIdentifier=ZZZZZ12345\n'},'packaged_signing_identity_mismatch'],[{assessment:'accepted\nsource=Developer ID\n'},'packaged_gatekeeper_notarization_missing'],[{symlinkApp:true},'packaged_app_missing_or_ambiguous'],[{symlinkBinary:true},'packaged_binary_symlink'],[{tamperDuringDetach:true},'dmg_changed_during_cleanup'],[{extraApp:true},'packaged_app_missing_or_ambiguous'],[{tamper:true},'dmg_changed_during_verification'],[{failCommand:'/usr/bin/xcrun:stapler'},'synthetic verifier failure']
] as const)('rejects incomplete or mismatched simulated evidence %j and detaches',async(overrides,error)=>{
 const f=await fixture(overrides);await expect(f.verify()).rejects.toThrow(error);expect(f.run).toHaveBeenCalledWith('/usr/bin/hdiutil',['detach',f.mounted()]);
});
it('never issues a positive receipt if detachment fails',async()=>{const f=await fixture({failCommand:'/usr/bin/hdiutil:detach'});await expect(f.verify()).rejects.toThrow();expect(await stat(f.mounted())).toBeTruthy();roots.push(path.dirname(f.mounted()));});
it('rejects a symlinked installer before running a verifier',async()=>{const f=await fixture();const link=path.join(f.root,'link.dmg');await symlink(f.dmg,link);await expect(verifyPackagedMacos({dmg:link,version:'0.1.21',teamId:'ABCDE12345',arch:'arm64',identifier:'com.visionxixlabs.axiom'},{run:f.run,platform:'darwin'})).rejects.toThrow('invalid_dmg_file');expect(f.run).not.toHaveBeenCalled();});
it('refuses a non-Mac host without claiming any evidence',async()=>{const f=await fixture();await expect(verifyPackagedMacos({dmg:f.dmg,version:'0.1.21',teamId:'ABCDE12345',arch:'arm64',identifier:'com.visionxixlabs.axiom'},{run:f.run,platform:'linux'})).rejects.toThrow('macos_verifier_requires_macos');expect(f.run).not.toHaveBeenCalled();});
