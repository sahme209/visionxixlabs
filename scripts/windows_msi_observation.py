"""Bounded read-only MSI setup observations. No installation or inferred paths."""
import ctypes,hashlib,itertools,json,re
from pathlib import Path
import windows_installed_acceptance as qa

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
def log_evidence(file,base,expected,component_key=None):
 if not file.is_file():return {'present':False}
 with file.open('rb') as stream:raw=stream.read(qa.MAX_LOG_BYTES+1)
 qa.need(len(raw)<=qa.MAX_LOG_BYTES,'msi_log_bound');text=raw.decode('utf-16-le' if b'\x00' in raw else 'utf-8',errors='replace')
 properties={}
 for name,value in re.findall(r'^Property\([SC]\): (INSTALLDIR|TARGETDIR|SourceDir|ROOTDRIVE|Installed|REINSTALL|REINSTALLMODE|ACTION) = ([^\r\n]{0,1024})',text,re.M):
  if name in ('INSTALLDIR','TARGETDIR','SourceDir','ROOTDRIVE'):
   try:properties[name]=path_evidence(value,base,expected)
   except RuntimeError:properties[name]={'provided':True,'invalidPath':True}
  else:properties[name]={'present':True,'isInstall':value=='INSTALL','isAll':value=='ALL','isOne':value=='1'}
 actions=[]
 if isinstance(component_key,str) and 0<len(component_key)<=256:
  allowed={'Absent','Local','Source','Advertise','Default','Null','Unknown','None'}
  pattern=r'Component: '+re.escape(component_key)+r'; Installed: ([A-Za-z]{1,24}); Request: ([A-Za-z]{1,24}); Action: ([A-Za-z]{1,24})(?:[;\r\n]|$)'
  for installed,request,action in re.findall(pattern,text):
   actions.append({name:value if value in allowed else 'UNRECOGNIZED' for name,value in [('installed',installed),('request',request),('action',action)]})
 return {'componentActions':actions[-8:],'componentActionEnumOnly':True,'present':True,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'properties':properties,'mainEngineReturnCodes':[int(x) for x in re.findall(r'MainEngineThread is returning ([0-9]{1,5})',text)[-8:]],'applicationFileMentioned': 'axiom-desktop.exe' in text,'applicationFileOperationLines':min(32,sum(1 for line in text.splitlines() if 'axiom-desktop.exe' in line and ('File:' in line or 'FileCopy(' in line))),'rawTextEmitted':False}
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


def observe_legacy_setup(runner,tools,base,install,candidate,product,log):
    result={'productState':qa.product_state(product),'requestedDirectoryExists':install.is_dir(),
            'directoryEntriesBounded':len(list(itertools.islice(install.iterdir(),32))) if install.is_dir() else 0}
    for name,operation in [
        ('requestedPayload',lambda:path_evidence(str(install/'axiom-desktop.exe'),base,install/'axiom-desktop.exe')),
        ('installLocations',lambda:install_location_evidence(product,base,install)),
        ('protocolLocations',lambda:[path_evidence(qa.parse_windows_command(value)[0],base,install/'axiom-desktop.exe') for value in qa.protocol_state()[:4] if qa.parse_windows_command(value)]),
        ('installLog',lambda:log_evidence(log,base,install)),
    ]:
        try:result[name]=operation()
        except Exception:result[name]={'observationUnavailable':True}
    try:
        component=json.loads(runner.run('legacy-msi-component-observation',[tools['pwsh.exe'],'-NoProfile','-NonInteractive','-File',qa.ROOT/'scripts/windows_msi_component.ps1','-Candidate',candidate],qa.ROOT,15))
        result['component']=component
        result['installLog']=log_evidence(log,base,install,component.get('componentKey'))
        state,location=component_location(product,component['componentGuid'])
        result['componentState']=state
        result['componentPath']=path_evidence(location,base,install/'axiom-desktop.exe')
    except Exception:result['componentObservationUnavailable']=True
    return result
