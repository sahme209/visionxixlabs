"""Fixed public legacy MSI read-only tables plus synthetic third-link observation."""
import sys
sys.dont_write_bytecode=True
import hashlib,json,os,shutil,time,uuid
from pathlib import Path
import windows_installed_acceptance as qa
from windows_msi_byte_diagnostic import authority,ASSET
from windows_msi_shortcut_preflight import fixture_script,vbs_string,phase_evidence,CSCRIPT_FLAGS
PRODUCT='{EA2907BA-437C-4D29-AD47-4A5ABFBB4CFD}'
def main():
 authority();base=qa.validated_runner_temp(os.environ.get('RUNNER_TEMP'))/('axiom-installed-third-link-'+uuid.uuid4().hex);base.mkdir(exist_ok=False);output=base/'evidence';output.mkdir();runner=qa.OwnedWindowsProcess(output,time.monotonic()+120)
 result={'accepted':False,'installerExecuted':False,'appBuilt':False,'fixedPublicLegacyOnly':True,'fullFailureResidualIdentityProven':False,'processes':runner.records};stage='source_guard'
 try:
  packet=qa.ROOT/'scripts/windows-legacy-uninstall-inputs.json';inputs=json.loads(packet.read_text());packet_hash=qa.digest(packet);qa.need(all(qa.digest(qa.ROOT/name)==value for name,value in inputs.items()),'reviewed_source_changed')
  tools={}
  for name in ('git.exe','pwsh.exe'):
   value=shutil.which(name);qa.need(bool(value),'managed_tool_missing');tools[name]=Path(value).resolve(strict=True);qa.need(tools[name].is_file(),'managed_tool_missing')
  host=(Path(os.environ['SYSTEMROOT'])/'System32/cscript.exe').resolve(strict=True);msiexec=(Path(os.environ['SYSTEMROOT'])/'System32/msiexec.exe').resolve(strict=True);qa.need(host.is_file() and msiexec.is_file(),'fixed_system_tools_missing')
  result['tools']={name:qa.digest(path) for name,path in [*tools.items(),('cscript',host),('msiexec_target_only',msiexec)]}
  qa.need(runner.run('checkout-head',[tools['git.exe'],'rev-parse','HEAD'],qa.ROOT,5).strip()==os.environ['GITHUB_SHA'],'checkout_head_changed')
  stage='fixed_legacy_download';assets=base/'legacy';proof=json.loads(runner.run('fixed-legacy-download',[sys.executable,qa.ROOT/'scripts/windows_msi_byte_diagnostic.py','--download',assets],qa.ROOT,35));qa.need(proof=={'sha256':ASSET['sha256'],'bytes':ASSET['bytes']},'legacy_receipt_changed');msi=qa.owned_file(assets/ASSET['name'],assets);qa.need(qa.digest(msi)==ASSET['sha256'],'legacy_asset_changed')
  stage='read_only_tables';tables=json.loads(runner.run('legacy-shortcut-tables',[tools['pwsh.exe'],'-NoProfile','-NonInteractive','-File',qa.ROOT/'scripts/windows_legacy_shortcut_tables.ps1','-Candidate',msi],qa.ROOT,15));result['legacyTables']=tables
  roots=[r for r in tables['shortcuts'] if r[1]=='INSTALLDIR' and 'Uninstall Axiom Agent' in r[2]];qa.need(len(roots)==1,'legacy_install_root_shortcut_not_unique');row=roots[0];qa.need(row[3]=='[System64Folder]msiexec.exe' and row[4] in ('/x [ProductCode]','/x[ProductCode]'),'legacy_uninstall_target_changed');qa.need(any(r[0]=='RemoveShortcuts' and r[1]=='Installed AND NOT UPGRADINGPRODUCTCODE' for r in tables['removeShortcuts']),'legacy_remove_condition_changed');result['thirdShortcutBinaryConfirmed']=True
  stage='synthetic_setup';app=base/'application';app.mkdir();desktop=base/'desktop';desktop.mkdir();menu=base/'programs'/'Axiom Agent';menu.mkdir(parents=True);newmenu=base/'programs'/'V19';newmenu.mkdir();target=app/'axiom-desktop.exe';target.write_bytes(b'synthetic never-executed target')
  links=[desktop/'Axiom Agent.lnk',menu/'Axiom Agent.lnk',desktop/'V19.lnk',newmenu/'V19.lnk'];third=app/'Uninstall Axiom Agent.lnk'
  def create(path,destination,args,label):
   script=base/(label+'.vbs');script.write_text('Dim s,l\nSet s=CreateObject("WScript.Shell")\nSet l=s.CreateShortcut('+vbs_string(str(path))+')\nl.TargetPath='+vbs_string(str(destination))+'\nl.Arguments='+vbs_string(args)+'\nl.Save\n',encoding='utf-16');runner.run(label,[host,*CSCRIPT_FLAGS,script],base,5)
  create(links[0],target,'','desktop-link');create(links[1],target,'','menu-link');create(third,msiexec,'/x '+PRODUCT,'third-link');before=third.read_bytes();source=(qa.ROOT/'desktop/src-tauri/windows/msi-shortcut-migration.vbs').read_text();data='|'.join(map(str,[target,*links]));result['migrationSourceSha256']=hashlib.sha256(source.encode()).hexdigest()
  for phase in ('preflight','migrate','commit'):
   stage=phase;script=base/(phase+'.vbs');script.write_text(fixture_script(source,phase,data),encoding='utf-16');runner.run(phase,[host,*CSCRIPT_FLAGS,script],base,5);phase_evidence(runner.records[-1])
  qa.need(not links[0].exists() and not links[1].exists(),'two_link_migration_failed');qa.need(third.is_file() and third.read_bytes()==before,'third_link_not_preserved');result['thirdSyntheticLinkRemainsByteExact']=True;result['twoAppLinksMigrated']=True
  result['sourceInputsMatched']=all(qa.digest(qa.ROOT/name)==value for name,value in inputs.items()) and qa.digest(packet)==packet_hash;result['accepted']=result['sourceInputsMatched']
 except Exception as error:result['failure']={'stage':stage,'code':str(error) if isinstance(error,RuntimeError) else 'fixed_legacy_shortcut_probe_failed'}
 finally:
  clean=False
  try:
   qa.need(not base.is_symlink() and all(not p.is_symlink() and not getattr(p,'is_junction',lambda:False)() for p in base.rglob('*')),'owned_fixture_link_changed')
   for p in list(base.iterdir()):
    if p!=output:
     if p.is_dir():shutil.rmtree(p)
     else:p.unlink()
   clean=all(p==output for p in base.iterdir())
  except Exception:result['cleanupFailure']='owned_fixture_cleanup_unconfirmed'
  result['ownedFixtureRemoved']=clean;result['ownedProcessesEmpty']=all(r['ownedJobEmpty'] for r in runner.records);result['accepted']=result['accepted'] and clean and result['ownedProcessesEmpty'];print('V19_LEGACY_THIRD_LINK_RESULT:'+qa.primary_receipt(result),flush=True)
 return 0 if result['accepted'] else 1
if __name__=='__main__':raise SystemExit(main())
