"""Fixed legacy baseline only: shallow install, nested reinstall, shallow reinstall."""
import sys
sys.dont_write_bytecode=True
import ctypes,hashlib,itertools,json,os,re,time,uuid
from pathlib import Path
import windows_installed_acceptance as qa
from windows_upgrade_acceptance import absent_before_owned_cycle,absent_after_cleanup
from windows_msi_byte_diagnostic import authority,diagnostic_tools,download,ASSET,metadata,remove_owned

def component_location(product,component):
 for value in [product,component]:qa.need(re.fullmatch(r'\{[0-9A-Fa-f-]{36}\}',value) is not None,'component_guid_invalid')
 from ctypes import wintypes as W
 api=ctypes.WinDLL('msi',use_last_error=True);api.MsiGetComponentPathW.argtypes=[W.LPCWSTR,W.LPCWSTR,W.LPWSTR,ctypes.POINTER(W.DWORD)];api.MsiGetComponentPathW.restype=ctypes.c_int
 size=W.DWORD(32768);buf=ctypes.create_unicode_buffer(32768);state=api.MsiGetComponentPathW(product,component,buf,ctypes.byref(size));qa.need(size.value<32768,'component_path_bound')
 return state,buf.value if state in (3,4) else ''
def path_evidence(value,base,expected):
 if not value:return {'provided':False}
 try:qa.windows_path_identity(str(value))
 except RuntimeError:return {'provided':True,'invalidPath':True,'outsideOwnedFileRead':False}
 actual=Path(value);inside=qa.windows_path_within(str(actual),str(base));result={'provided':True,'insideOwnedRoot':inside,'matchesRequestedPath':qa.windows_path_identity(str(actual))==qa.windows_path_identity(str(expected)),'outsideOwnedFileRead':False}
 if inside:
  # Resolve parent links and prove physical custody before file-size/content
  # inspection. Missing owned paths stay ordinary absent observations.
  physical=actual.resolve(strict=False)
  if not physical.is_relative_to(base.resolve(strict=True)) or actual.is_symlink():
   result.update({'physicalOwnershipRefused':True,'regularFile':False});return result
  result['physicalOwnedPathValidated']=True
  result['ownedRelativePath']=str(actual.relative_to(base));result['regularFile']=actual.is_file()
  if result['regularFile']:
   admitted=qa.owned_file(actual,base)
   result.update({'bytes':admitted.stat().st_size,'sha256':qa.digest(admitted)})
 return result
def log_evidence(file,base,expected):
 if not file.is_file():return {'present':False}
 with file.open('rb') as stream:raw=stream.read(qa.MAX_LOG_BYTES+1)
 qa.need(len(raw)<=qa.MAX_LOG_BYTES,'msi_log_bound');text=raw.decode('utf-16-le' if b'\x00' in raw else 'utf-8',errors='replace')
 properties={}
 for name,value in re.findall(r'^Property\([SC]\): (INSTALLDIR|TARGETDIR|SourceDir|ROOTDRIVE|Installed|REINSTALL|REINSTALLMODE|ACTION) = ([^\r\n]{0,1024})',text,re.M):
  if name in ('INSTALLDIR','TARGETDIR','SourceDir','ROOTDRIVE'):
   try:properties[name]=path_evidence(value,base,expected)
   except RuntimeError:properties[name]={'provided':True,'invalidPath':True}
  else:properties[name]={'present':True,'isInstall':value=='INSTALL','isAll':value=='ALL','isOne':value=='1'}
 return {'present':True,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'properties':properties,'mainEngineReturnCodes':[int(x) for x in re.findall(r'MainEngineThread is returning ([0-9]{1,5})',text)[-8:]],'applicationFileMentioned': 'axiom-desktop.exe' in text,'applicationFileOperationLines':min(32,sum(1 for line in text.splitlines() if 'axiom-desktop.exe' in line and ('File:' in line or 'FileCopy(' in line))),'rawTextEmitted':False}
def install_location_evidence(product,base,expected):
 import winreg
 result=[]
 for hive in (winreg.HKEY_CURRENT_USER,winreg.HKEY_LOCAL_MACHINE):
  for view in (winreg.KEY_WOW64_64KEY,winreg.KEY_WOW64_32KEY):
   for name in (product,'Axiom Agent'):
    try:
     with winreg.OpenKey(hive,r'Software\Microsoft\Windows\CurrentVersion\Uninstall'+'\\'+name,0,winreg.KEY_READ|view) as key:
      value,kind=winreg.QueryValueEx(key,'InstallLocation')
      if kind in (winreg.REG_SZ,winreg.REG_EXPAND_SZ) and isinstance(value,str) and len(value)<=32768:
       result.append(path_evidence(value,base,expected))
    except FileNotFoundError:pass
 return result[:8]


def main():
 authority();tools,toolProof=diagnostic_tools();base=qa.validated_runner_temp(os.environ.get('RUNNER_TEMP'))/('axiom-installed-msi-reinstall-'+uuid.uuid4().hex);base.mkdir();output=base/'evidence';output.mkdir();runner=qa.OwnedWindowsProcess(output,time.monotonic()+180)
 result={'accepted':False,'baselineOnly':'fixed-public-0.1.21','v19PredecessorNotReproduced':True,'published':False,'cases':[],'phases':runner.records,'tools':toolProof};fixtures=base/'fixture';cleanup_ok=True
 try:
  qa.need(runner.run('source-head',[tools['git.exe'],'rev-parse','HEAD'],qa.ROOT,5)==os.environ['GITHUB_SHA'],'source_changed');qa.need(not qa.protocol_state(),'existing_protocol_refused');qa.require_webview_runtime();qa.snapshot_helper_preflight(runner,tools,base)
  proof=json.loads(runner.run('fixed-download',[tools['python.exe'],Path(__file__),'--download',fixtures],qa.ROOT,35));qa.need(proof=={'sha256':ASSET['sha256'],'bytes':ASSET['bytes']},'download_proof_changed');candidate=qa.owned_file(fixtures/ASSET['name'],fixtures);qa.need(qa.digest(candidate)==ASSET['sha256'],'fixed_asset_changed');package=metadata(runner,tools,candidate,'legacy-metadata');code=package['ProductCode']
  component=json.loads(runner.run('component-metadata',[tools['pwsh.exe'],'-NoProfile','-NonInteractive','-File',qa.ROOT/'scripts/windows_msi_component.ps1','-Candidate',candidate],qa.ROOT,15));result['component']=component
  for label,install in [('shallow-no-admin',base/'shallow-no-admin'),('nested-no-admin',base/'nested-no-admin'/'msi-major-upgrade'),('shallow-after-admin',base/'shallow-after-admin'),('nested-after-admin',base/'nested-after-admin'/'msi-major-upgrade')]:
   if label=='shallow-after-admin':
    extract=base/'administrative-extraction';extract.mkdir();result['adminCleanupConfirmed']=False;qa.msi_absent(qa.product_state(code))
    log=output/'administrative-extraction.log'
    try:
     runner.run('administrative-extraction',[tools['msiexec.exe'],'/a',candidate,'/qn','/norestart','TARGETDIR='+str(extract),'/L*v',log],qa.ROOT,45,extra_logs=(log,))
     qa.msi_absent(qa.product_state(code));qa.need(not qa.protocol_state(),'admin_registered_protocol');result['administrativeExtractionConfirmed']=True
    finally:
     # Admin mode is execution too: fixed previously absent ProductCode cleanup.
     prior=runner.deadline;runner.deadline=max(prior,time.monotonic()+55)
     try:
      log=output/'administrative-cleanup.log';runner.run('administrative-cleanup',[tools['msiexec.exe'],'/x',code,'/qn','/norestart','/L*v',log],qa.ROOT,45,allow=(0,1605),extra_logs=(log,));qa.msi_absent(qa.product_state(code));qa.need(not qa.protocol_state(),'admin_cleanup_protocol_remains');absent_after_cleanup(qa.upgrade_snapshot(runner,tools,base,[base/'admin-unused'],[code],'admin-cleaned'));result['adminCleanupConfirmed']=True
     finally:runner.deadline=prior
   qa.need(not install.exists(),'install_path_not_fresh');qa.msi_absent(qa.product_state(code));absent_before_owned_cycle(qa.upgrade_snapshot(runner,tools,base,[install],[code],label+'-pristine'));row={'case':label,'installConfirmed':False,'cleanupConfirmed':False};result['cases'].append(row);armed=False
   try:
    armed=True;log=output/(label+'.log');runner.run(label+'-install',[tools['msiexec.exe'],'/i',candidate,'/qn','/norestart','INSTALLDIR='+str(install),'/L*v',log],qa.ROOT,45,extra_logs=(log,));row['productState']=qa.product_state(code);row['installDirectoryExists']=install.is_dir();row['directoryFileCountBounded']=len(list(itertools.islice(install.iterdir(),32))) if install.is_dir() else 0;row['log']=log_evidence(log,base,install)
    state,location=component_location(code,component['componentGuid']);row['componentState']=state;row['componentPath']=path_evidence(location,base,install/'axiom-desktop.exe');row['productInstallLocations']=install_location_evidence(code,base,install);row['protocolLocations']=[path_evidence(qa.parse_windows_command(value)[0],base,install/'axiom-desktop.exe') for value in qa.protocol_state()[:4] if qa.parse_windows_command(value)];row['requestedPayload']=path_evidence(str(install/'axiom-desktop.exe'),base,install/'axiom-desktop.exe')
    if row['requestedPayload'].get('regularFile'):
     exe=qa.owned_file(install/'axiom-desktop.exe',install);qa.require_pe_role(exe,'Application');row['payloadMetadata']=metadata(runner,tools,exe,label+'-payload');row['installConfirmed']=row['productState']==5
    else:row['failure']='expected_payload_missing'
   finally:
    if armed:
     prior=runner.deadline;runner.deadline=max(prior,time.monotonic()+55)
     try:
      log=output/(label+'-uninstall.log');runner.run(label+'-uninstall',[tools['msiexec.exe'],'/x',code,'/qn','/norestart','/L*v',log],qa.ROOT,45,allow=(0,1605),extra_logs=(log,));qa.msi_absent(qa.product_state(code));absent_after_cleanup(qa.upgrade_snapshot(runner,tools,base,[install],[code],label+'-cleaned'));qa.need(not install.exists() or not any(install.iterdir()),'install_directory_residual');row['cleanupConfirmed']=True
     finally:runner.deadline=prior
   qa.need(row['cleanupConfirmed'],'cycle_cleanup_unconfirmed')
  result['diagnosticCompleted']=len(result['cases'])==4;result['accepted']=result['diagnosticCompleted'] and all(r['installConfirmed'] and r['cleanupConfirmed'] for r in result['cases'])
 except Exception as error:result['failure']=str(error) if isinstance(error,RuntimeError) else 'fixed_diagnostic_failure'
 finally:
  cleanup_ok=all(row['cleanupConfirmed'] for row in result['cases']) and result.get('adminCleanupConfirmed',True)
  if cleanup_ok:
   try:
    for name in ['fixture','shallow-no-admin','nested-no-admin','shallow-after-admin','nested-after-admin','administrative-extraction']:remove_owned(base/name,base)
   except Exception:cleanup_ok=False
  result['ownedDirectoriesCleaned']=cleanup_ok;result['ownedProcessesEmpty']=all(r['ownedJobEmpty'] for r in runner.records);result['accepted']=result['accepted'] and cleanup_ok and result['ownedProcessesEmpty'];print('V19_LEGACY_REINSTALL_RESULT:'+qa.primary_receipt(result),flush=True)
 return 0 if result['accepted'] else 1
if __name__=='__main__':
 if len(sys.argv)==3 and sys.argv[1]=='--download':download(Path(sys.argv[2]))
 else:raise SystemExit(main())
