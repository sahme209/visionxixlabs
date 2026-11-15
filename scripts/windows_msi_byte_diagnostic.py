"""Fixed legacy0.1.21 MSI extraction/install byte diagnostic; no candidate build."""
import sys
sys.dont_write_bytecode=True
import hashlib,json,os,shutil,time,uuid,urllib.request,urllib.parse
from pathlib import Path
import windows_installed_acceptance as qa
from windows_upgrade_acceptance import LEGACY_ASSETS,absent_before_owned_cycle,absent_after_cleanup
BRANCH='codex/windows-msi-byte-diagnostic'
ASSET=LEGACY_ASSETS['msi']
def need(ok,code):qa.need(ok,code)
class Redirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,url):
  parsed=urllib.parse.urlsplit(url)
  need(parsed.scheme=='https' and parsed.hostname in ('github.com','release-assets.githubusercontent.com','objects.githubusercontent.com') and not parsed.username and not parsed.password,'fixed_redirect_refused')
  return super().redirect_request(req,fp,code,msg,headers,url)
def download(folder):
 folder.mkdir(exist_ok=False);destination=folder/ASSET['name'];partial=folder/'fixed.part';size=0;h=hashlib.sha256()
 try:
  with urllib.request.build_opener(Redirect()).open('https://github.com/sahme209/axiom-releases/releases/download/desktop-v0.1.21/'+ASSET['name'],timeout=15) as response,partial.open('xb') as out:
   while True:
    block=response.read(65536)
    if not block:break
    size+=len(block);need(size<=ASSET['bytes'],'fixed_asset_oversize');h.update(block);out.write(block)
  need(size==ASSET['bytes'] and h.hexdigest()==ASSET['sha256'],'fixed_asset_mismatch');partial.rename(destination)
 finally:
  if partial.exists():partial.unlink()
 print(json.dumps({'sha256':h.hexdigest(),'bytes':size}))
def authority():
 need(os.name=='nt' and os.environ.get('ImageOS')=='win22','standard_windows_required')
 need(os.environ.get('GITHUB_EVENT_NAME')=='push' and os.environ.get('GITHUB_RUN_ATTEMPT')=='1' and os.environ.get('GITHUB_REPOSITORY')=='sahme209/visionxixlabs' and os.environ.get('GITHUB_ACTOR')=='sahme209' and os.environ.get('GITHUB_REF')=='refs/heads/'+BRANCH,'fixed_owner_branch_required')
 event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
 need(event['repository']['id']==1130181785 and event['repository']['private'] is False and event['repository']['full_name']=='sahme209/visionxixlabs' and event.get('after')==os.environ.get('GITHUB_SHA'),'fixed_public_source_required')
def diagnostic_tools():
 # Only tools actually used here; no Node/Cargo/Rust discovery or setup.
 result={}
 for name in ('msiexec.exe','pwsh.exe','git.exe'):
  found=shutil.which(name);need(found is not None,'diagnostic_tool_missing')
  path=Path(found).resolve(strict=True)
  need(path.is_file() and path.suffix.lower()=='.exe','diagnostic_tool_invalid')
  if name=='msiexec.exe':
   need(path==(Path(os.environ['SYSTEMROOT'])/'System32/msiexec.exe').resolve(strict=True),'windows_installer_path_changed')
  result[name]=str(path)
 python=Path(sys.executable).resolve(strict=True);need(python.is_file() and python.suffix.lower()=='.exe','python_tool_invalid');result['python.exe']=str(python)
 return result,{name:{'sha256':qa.digest(Path(value))} for name,value in result.items()}
def metadata(runner,tools,file,label):
 return json.loads(runner.run(label,[tools['pwsh.exe'],'-NoProfile','-NonInteractive','-File',qa.ROOT/'scripts/windows_installer_metadata.ps1','-Candidate',file,'-ExpectedVersion','0.1.21','-Role','Legacy','-ArtifactKind','MsiInstaller' if file.suffix.lower()=='.msi' else 'Application'],qa.ROOT,15))
def remove_owned(path,base):
 need(path.parent==base and not path.is_symlink(),'cleanup_scope_changed')
 if path.exists():
  need(all(not p.is_symlink() for p in path.rglob('*')),'cleanup_link_refused');shutil.rmtree(path)
def main():
 authority();tools,toolEvidence=diagnostic_tools();base=qa.validated_runner_temp(os.environ.get('RUNNER_TEMP'))/('axiom-installed-msi-byte-'+uuid.uuid4().hex);base.mkdir(exist_ok=False);output=base/'evidence';output.mkdir();runner=qa.OwnedWindowsProcess(output,time.monotonic()+180)
 result={'accepted':False,'tools':toolEvidence,'baselineOnly':'fixed-public-0.1.21','v19MismatchFixed':False,'published':False,'installAttempted':False,'cleanupArmed':False,'uninstallConfirmed':False,'cleanupConfirmed':False,'phases':runner.records};code=None
 extract=base/'extracted';install=base/'installed';fixtures=base/'fixture'
 try:
  head=runner.run('source-head',[tools['git.exe'],'rev-parse','HEAD'],qa.ROOT,5);need(head==os.environ['GITHUB_SHA'],'checked_source_changed')
  need(not qa.protocol_state(),'existing_protocol_refused');result['webview']=qa.require_webview_runtime()
  qa.snapshot_helper_preflight(runner,tools,base)
  proof=json.loads(runner.run('fixed-legacy-download',[tools['python.exe'],Path(__file__),'--download',fixtures],qa.ROOT,35));need(proof=={'sha256':ASSET['sha256'],'bytes':ASSET['bytes']},'download_receipt_mismatch')
  candidate=qa.owned_file(fixtures/ASSET['name'],fixtures);need(qa.digest(candidate)==ASSET['sha256'],'legacy_msi_changed');meta=metadata(runner,tools,candidate,'legacy-msi-metadata');code=meta['ProductCode'];qa.msi_absent(qa.product_state(code))
  absent_before_owned_cycle(qa.upgrade_snapshot(runner,tools,base,[install],[code],'pristine'))
  result['cleanupArmed']=True
  extract.mkdir();log=output/'extract.log';runner.run('administrative-extract',[tools['msiexec.exe'],'/a',candidate,'/qn','/norestart','TARGETDIR='+str(extract),'/L*v',log],qa.ROOT,45,extra_logs=(log,));qa.msi_absent(qa.product_state(code));need(not qa.protocol_state(),'administrative_extract_registered_protocol')
  found=list(extract.rglob('axiom-desktop.exe'));need(len(found)==1,'extracted_payload_ambiguous');payload=qa.owned_file(found[0],extract);qa.require_pe_role(payload,'Application');result['extracted']=metadata(runner,tools,payload,'extracted-metadata')
  need(qa.digest(candidate)==ASSET['sha256'],'legacy_msi_changed_after_extract')
  result['installAttempted']=True;log=output/'install.log';runner.run('install',[tools['msiexec.exe'],'/i',candidate,'/qn','/norestart','INSTALLDIR='+str(install),'/L*v',log],qa.ROOT,60,extra_logs=(log,));need(qa.product_state(code)==5,'product_not_installed')
  actual=qa.owned_file(install/'axiom-desktop.exe',install);qa.require_pe_role(actual,'Application')
  # Always retain actual fixed byte evidence before the strict comparison.
  result['installed']={'sha256':qa.digest(actual),'bytes':actual.stat().st_size,'machine':'AMD64'}
  result['byteIdentical']=result['installed']['sha256']==result['extracted']['sha256'] and result['installed']['bytes']==result['extracted']['bytes']
  need(result['byteIdentical'],'legacy_extraction_install_payload_mismatch');result['installedVersion']=metadata(runner,tools,actual,'installed-metadata');result['accepted']=True
 except Exception as error:result['failure']=str(error) if isinstance(error,RuntimeError) else 'fixed_diagnostic_failure'
 finally:
  if result['cleanupArmed']:
   runner.deadline=max(runner.deadline,time.monotonic()+55)
   try:
    log=output/'uninstall.log';runner.run('uninstall',[tools['msiexec.exe'],'/x',code,'/qn','/norestart','/L*v',log],qa.ROOT,45,allow=(0,1605),extra_logs=(log,));qa.msi_absent(qa.product_state(code));absent_after_cleanup(qa.upgrade_snapshot(runner,tools,base,[install],[code],'cleaned'));result['uninstallConfirmed']=True
   except Exception:result['accepted']=False;result['cleanupFailure']='uninstall_or_absence_unconfirmed'
  try:
   need(not result['cleanupArmed'] or result['uninstallConfirmed'],'installed_cleanup_unconfirmed')
   for p in [extract,install,fixtures]:remove_owned(p,base)
   result['cleanupConfirmed']=True
  except Exception:result['accepted']=False;result['cleanupFailure']='owned_directory_cleanup_unconfirmed'
  result['ownedProcessesEmpty']=all(r['ownedJobEmpty'] for r in runner.records);result['accepted']=result['accepted'] and result['cleanupConfirmed'] and result['uninstallConfirmed'] and result['ownedProcessesEmpty'];print('V19_LEGACY_MSI_BYTE_RESULT:'+qa.primary_receipt(result),flush=True)
 return 0 if result['accepted'] else 1
if __name__=='__main__':
 if len(sys.argv)==3 and sys.argv[1]=='--download':download(Path(sys.argv[2]))
 else:raise SystemExit(main())
