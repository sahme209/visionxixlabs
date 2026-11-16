"""Synthetic mini-MSI exercises exact migration; never builds or launches application."""
import sys
sys.dont_write_bytecode=True
import json,os,shutil,time,uuid
from pathlib import Path
import windows_installed_acceptance as qa
from windows_msi_byte_diagnostic import authority,ASSET
from windows_upgrade_acceptance import absent_before_owned_cycle,absent_after_cleanup
from windows_registry_wix_diagnostic import installed_tools
from windows_residual_metadata import installation_residual_metadata,bounded_msi_log_tail
from windows_msi_shortcut_preflight import vbs_string
OLD='{EA2907BA-437C-4D29-AD47-4A5ABFBB4CFD}'
NEW='{46704BAF-7D89-48BA-AF9C-C50D933813D8}'
ROLLBACK='{D4907127-8B23-42C5-B0D0-1AC545DA54C4}'
def main():
 authority();base=qa.validated_runner_temp(os.environ.get('RUNNER_TEMP'))/('axiom-installed-mini-'+uuid.uuid4().hex);base.mkdir(exist_ok=False);output=base/'evidence';output.mkdir();runner=qa.OwnedWindowsProcess(output,time.monotonic()+240);app=base/'application';fixtures=base/'fixtures';logs=[]
 result={'accepted':False,'syntheticMiniMsiOnly':True,'releaseAcceptance':False,'applicationBuilt':False,'applicationLaunched':False,'cases':[],'processes':runner.records};stage='source';armed=False;foreign=None;foreign_bytes=None
 try:
  packet=qa.ROOT/'scripts/windows-third-mini-inputs.json';inputs=json.loads(packet.read_text());packet_hash=qa.digest(packet);qa.need(all(qa.digest(qa.ROOT/n)==h for n,h in inputs.items()),'reviewed_source_changed')
  tools={}
  for n in ('git.exe','pwsh.exe','msiexec.exe'):
   v=shutil.which(n);qa.need(bool(v),'managed_tool_missing');tools[n]=str(Path(v).resolve(strict=True))
  qa.need(Path(tools['msiexec.exe'])==(Path(os.environ['SYSTEMROOT'])/'System32/msiexec.exe').resolve(strict=True),'installer_system_path_changed')
  qa.need(runner.run('source-head',[tools['git.exe'],'rev-parse','HEAD'],qa.ROOT,5).strip()==os.environ['GITHUB_SHA'],'source_head_changed');result['webview']=qa.require_webview_runtime();candle,light=installed_tools()
  for n,t in [('candle',candle),('light',light)]:qa.need('3.14.1.8722' in runner.run(n+'-version',[t,'-?'],base,10),'managed_wix_version_changed')
  qa.snapshot_helper_preflight(runner,tools,base)
  for c in (OLD,NEW,ROLLBACK):qa.msi_absent(qa.product_state(c))
  absent_before_owned_cycle(qa.upgrade_snapshot(runner,tools,base,[app],[OLD,NEW],'initial-pristine'));armed=True
  stage='download';proof=json.loads(runner.run('fixed-legacy-download',[sys.executable,qa.ROOT/'scripts/windows_msi_byte_diagnostic.py','--download',fixtures],qa.ROOT,35));qa.need(proof=={'sha256':ASSET['sha256'],'bytes':ASSET['bytes']},'legacy_receipt_changed');legacy=qa.owned_file(fixtures/ASSET['name'],fixtures);qa.need(qa.digest(legacy)==ASSET['sha256'],'legacy_changed')
  def install(path,label,allowed=(0,)):
   log=output/(label+'.log');logs.append((label,log));runner.run(label,[tools['msiexec.exe'],'/i',path,'/qn','/norestart','INSTALLDIR='+str(app),'/L*v',log],qa.ROOT,35,allow=allowed,extra_logs=(log,));return runner.records[-1]['exitCode']
  def uninstall(code,label,timeout=25):
   log=output/(label+'.log');logs.append((label,log));runner.run(label,[tools['msiexec.exe'],'/x',code,'/qn','/norestart','/L*v',log],qa.ROOT,timeout,allow=(0,1605),extra_logs=(log,));qa.msi_absent(qa.product_state(code))
  def snapshot(label):return qa.upgrade_snapshot(runner,tools,base,[app],[OLD,NEW],label)
  def hashlinks(state):
   qa.need(len(state['shortcuts'])==2,'legacy_app_shortcut_count_changed')
   paths=[]
   for row in state['shortcuts']:
    p=Path(row['path']);qa.need(p.name=='Axiom Agent.lnk' and str(row['target']).casefold()==str(app/'axiom-desktop.exe').casefold() and not row['arguments'],'legacy_app_shortcut_identity_changed');paths.append(p)
   paths.append(app/'Uninstall Axiom Agent.lnk')
   return {str(p):qa.digest(qa.owned_file(p,p.parent)) for p in paths}
  def log_proof(label,required):
   path=output/(label+'.log');raw=path.read_bytes();qa.need(len(raw)<=8*1024*1024,'msi_log_bound');text=raw.decode('utf-16' if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8',errors='replace');observed={token:token in text for token in required};result.setdefault('fixedErrorObservations',{})[label]=observed;qa.need(all(observed.values()),'required_msi_error_reason_missing')
  def clean_case(label):
   for c in (NEW,ROLLBACK,OLD):uninstall(c,label+'-cleanup-'+c.strip('{}')[:8])
   result['lastResiduals']=installation_residual_metadata(base)
   absent_after_cleanup(snapshot(label+'-absent'));qa.need(not app.exists() or not any(app.iterdir()),'owned_application_residuals')
   if app.exists():qa.need(app.parent==base and not app.is_symlink() and not getattr(app,'is_junction',lambda:False)(),'application_owner_changed');app.rmdir()
  stage='legacy-install';install(legacy,'initial-old-install');qa.need(qa.product_state(OLD)==5,'old_not_installed');payload=qa.owned_file(app/'axiom-desktop.exe',app);copy=base/'known-old-payload.exe';shutil.copyfile(payload,copy);qa.need(qa.digest(copy)==qa.digest(payload),'copied_payload_changed')
  result['liveIdentity']=json.loads(runner.run('live-legacy-identity',[tools['pwsh.exe'],'-NoProfile','-NonInteractive','-File',qa.ROOT/'scripts/windows_legacy_live_identity.ps1','-ExpectedInstall',app],qa.ROOT,10));qa.need(result['liveIdentity']['oldProductInfo']['InstalledProductName']=='Axiom Agent' and result['liveIdentity']['oldProductInfo']['Publisher']=='visionxixlabs' and OLD in result['liveIdentity']['relatedProductCodes'] and result['liveIdentity']['componentMatchesOwnedPayload'] and result['liveIdentity']['legacyRootTargetSystem64'] and result['liveIdentity']['legacyRootArgsExact'],'live_legacy_identity_changed')
  result['residualHandleMetadata']=installation_residual_metadata(base);result['residualShortcutMetadata']=json.loads(runner.run('residual-shortcut-metadata',[tools['pwsh.exe'],'-NoProfile','-NonInteractive','-File',qa.ROOT/'scripts/windows_residual_shortcuts.ps1','-OwnedRoot',base,'-OldProductCode',OLD,'-NewProductCode',NEW],qa.ROOT,10))
  packages={}
  for mode,code in [('commit',NEW),('rollback',ROLLBACK)]:
   stage=mode+'-mini-build';wxs=base/(mode+'.wxs');obj=base/(mode+'.wixobj');msi=base/(mode+'.msi');runner.run(mode+'-generate',[sys.executable,qa.ROOT/'scripts/windows_third_mini_generate.py','--template',qa.ROOT/'desktop/src-tauri/windows/main.wxs','--application-source',copy,'--install-directory',app,'--mode',mode,'--product-code',code,'--output',wxs],qa.ROOT,5);runner.run(mode+'-candle',[candle,'-nologo','-arch','x64','-out',obj,wxs],base,15);runner.run(mode+'-light',[light,'-nologo','-out',msi,obj],base,25);qa.owned_file(msi,base);packages[mode]=msi
  for case in ('foreign-legacy','foreign-current','rollback','commit'):
   stage=case
   if case!='foreign-legacy':install(legacy,case+'-old-install');qa.need(qa.product_state(OLD)==5,'old_not_installed')
   before=hashlinks(snapshot(case+'-old-state'));original=None;foreign=None;foreign_bytes=None
   if case.startswith('foreign-'):
    foreign=app/('Uninstall Axiom Agent.lnk' if case=='foreign-legacy' else 'Uninstall V19.lnk');original=foreign.read_bytes() if foreign.exists() else None
    script=base/(case+'.vbs');script.write_text('Dim s,l\nSet s=CreateObject("WScript.Shell")\nSet l=s.CreateShortcut('+vbs_string(str(foreign))+')\nl.TargetPath='+vbs_string(str(copy))+'\nl.Arguments="foreign owned fixture"\nl.Save\n',encoding='utf-16');runner.run(case+'-seed',[(Path(os.environ['SYSTEMROOT'])/'System32/cscript.exe'),'//NoLogo',script],base,5);foreign_bytes=foreign.read_bytes()
    code=install(packages['commit'],case+'-refuse',(1603,));qa.need(all(qa.digest(Path(p))==h for p,h in before.items() if Path(p)!=foreign),'foreign_refusal_changed_other_legacy_links');log_proof(case+'-refuse',['V19ShortcutPreflight','Foreign uninstall shortcut preserved']);qa.need(code==1603 and foreign.read_bytes()==foreign_bytes,'foreign_refusal_not_preserved');qa.msi_absent(qa.product_state(NEW));qa.need(qa.product_state(OLD)==5,'foreign_refusal_removed_old');result['cases'].append({'case':case,'refused1603':True,'foreignByteExact':True})
    if original is None:foreign.unlink()
    else:foreign.write_bytes(original)
    foreign=None
   elif case=='rollback':
    qa.need(install(packages['rollback'],'injected-rollback',(1603,))==1603,'rollback_not_refused');log_proof('injected-rollback',['Fixture all three backups verified; rollback requested']);qa.need(qa.product_state(OLD)==5,'rollback_old_missing');qa.msi_absent(qa.product_state(ROLLBACK));qa.need(all(Path(p).read_bytes() and qa.digest(Path(p))==h for p,h in before.items()),'rollback_third_link_changed');qa.need(not list(app.glob('*.v19-legacy-*.lnk')),'rollback_backup_residual');result['cases'].append({'case':case,'oldRestored':True,'allThreeLinksByteExact':True,'threeBackupsObservedBeforeInjectedFailure':True})
   else:
    install(packages['commit'],'mini-commit');qa.msi_absent(qa.product_state(OLD));qa.need(qa.product_state(NEW)==5,'mini_product_missing');qa.need(not (app/'Uninstall Axiom Agent.lnk').exists() and not list(app.glob('*.v19-legacy-*.lnk')),'commit_legacy_root_residual');newlinks=snapshot('commit-upgraded-state')['shortcuts'];qa.need(len(newlinks)==2 and all(Path(row['path']).name=='V19.lnk' and str(row['target']).casefold()==str(app/'axiom-desktop.exe').casefold() and not row['arguments'] for row in newlinks),'new_app_links_invalid');current=json.loads(runner.run('live-candidate-identity',[tools['pwsh.exe'],'-NoProfile','-NonInteractive','-File',qa.ROOT/'scripts/windows_legacy_live_identity.ps1','-ExpectedInstall',app,'-ExpectedProductCode',NEW,'-ShortcutKind','Current'],qa.ROOT,10));qa.need(current['oldProductInfo']['InstalledProductName']=='V19' and current['oldProductInfo']['Publisher']=='visionxixlabs' and current['componentMatchesOwnedPayload'] and current['legacyRootTargetSystem64'] and current['legacyRootArgsExact'],'current_root_shortcut_invalid');result['currentIdentity']=current;result['cases'].append({'case':case,'upgradeConfirmed':True,'thirdLinkRemoved':True})
   clean_case(case)
  result['sourceInputsMatched']=all(qa.digest(qa.ROOT/n)==h for n,h in inputs.items()) and qa.digest(packet)==packet_hash;result['accepted']=result['sourceInputsMatched'] and len(result['cases'])==4
 except Exception as error:result['failure']={'stage':stage,'code':str(error) if isinstance(error,RuntimeError) else 'fixed_mini_msi_probe_failed'}
 finally:
  result['msiDiagnostics']={}
  for label,path in logs:
   if path.is_file() and (any(token in label for token in ('refuse','injected-rollback','mini-commit')) or (label,path) in logs[-3:]):
    try:result['msiDiagnostics'][label]=bounded_msi_log_tail(path)
    except Exception:result['msiDiagnostics'][label]={'tailUnavailable':True}
  if armed:
   runner.deadline=max(runner.deadline,time.monotonic()+65)
   try:
    if foreign is not None:
     qa.need(foreign.is_file() and foreign.read_bytes()==foreign_bytes,'foreign_cleanup_identity_changed')
     if original is None:foreign.unlink()
     else:foreign.write_bytes(original)
    for c in (NEW,ROLLBACK,OLD):uninstall(c,'final-cleanup-'+c.strip('{}')[:8],timeout=12)
    result['lastResiduals']=installation_residual_metadata(base);absent_after_cleanup(snapshot('final-absent'));qa.need(not app.exists() or not any(app.iterdir()),'final_application_residuals');result['installedCleanupConfirmed']=True
   except Exception:result['accepted']=False;result['cleanupFailure']='installed_cleanup_unconfirmed'
  try:
   qa.need(not armed or result.get('installedCleanupConfirmed'),'installed_cleanup_unconfirmed');qa.need(not base.is_symlink() and all(not p.is_symlink() and not getattr(p,'is_junction',lambda:False)() for p in base.rglob('*')),'owned_fixture_link_changed')
   for p in list(base.iterdir()):
    if p!=output:
     if p.is_dir():shutil.rmtree(p)
     else:p.unlink()
   result['ownedFixtureRemoved']=True
  except Exception:result['accepted']=False;result['fixtureCleanupFailure']='owned_fixture_cleanup_unconfirmed'
  result['ownedProcessesEmpty']=all(p['ownedJobEmpty'] for p in runner.records);result['accepted']=result['accepted'] and result.get('installedCleanupConfirmed',False) and result.get('ownedFixtureRemoved',False) and result['ownedProcessesEmpty'];print('V19_THIRD_MINI_RESULT:'+qa.primary_receipt(result),flush=True)
 return 0 if result['accepted'] else 1
if __name__=='__main__':raise SystemExit(main())
