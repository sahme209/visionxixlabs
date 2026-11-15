import importlib.util,sys,json,tempfile,unittest,contextlib,io,hashlib,os
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('quick_msi',Path(__file__).with_name('windows_msi_byte_diagnostic.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class QuickDiagnostic(unittest.TestCase):
 def case(self,changed):
  with tempfile.TemporaryDirectory() as folder:
   temp=Path(folder);calls=[];payload=b'synthetic-original';installed=b'synthetic-different' if changed else payload
   class Runner:
    def __init__(self,output,deadline):self.output=output;self.deadline=deadline;self.records=[]
    def run(self,label,args,cwd,limit,**kw):
     calls.append(label)
     if label=='source-head':return 'a'*40
     if label=='fixed-legacy-download':
      p=Path(args[-1]);p.mkdir();(p/m.ASSET['name']).write_bytes(b'msi');return json.dumps({'sha256':m.ASSET['sha256'],'bytes':m.ASSET['bytes']})
     if label=='legacy-msi-metadata':return json.dumps({'ProductCode':'synthetic'})
     if label=='administrative-extract':
      p=Path(next(str(a).split('=',1)[1] for a in args if str(a).startswith('TARGETDIR=')));(p/'axiom-desktop.exe').write_bytes(payload)
     if label=='extracted-metadata':return json.dumps({'sha256':hashlib.sha256(payload).hexdigest(),'bytes':len(payload),'machine':'AMD64','ProductVersion':'0.1.21'})
     if label=='install':
      p=Path(next(str(a).split('=',1)[1] for a in args if str(a).startswith('INSTALLDIR=')));p.mkdir();(p/'axiom-desktop.exe').write_bytes(installed)
     if label=='installed-metadata':return '{}'
     return ''
   capture=io.StringIO()
   with patch.dict(os.environ,{'GITHUB_SHA':'a'*40,'RUNNER_TEMP':str(temp)}),patch.object(m,'authority'),patch.object(m,'diagnostic_tools',return_value=({'git.exe':'git','pwsh.exe':'pwsh','msiexec.exe':'msi','python.exe':'python'},{})),patch.object(m.qa,'validated_runner_temp',return_value=temp),patch.object(m.qa,'OwnedWindowsProcess',Runner),patch.object(m.qa,'protocol_state',return_value=[]),patch.object(m.qa,'require_webview_runtime',return_value={}),patch.object(m.qa,'snapshot_helper_preflight'),patch.object(m.qa,'upgrade_snapshot',return_value={}),patch.object(m,'absent_before_owned_cycle'),patch.object(m,'absent_after_cleanup'),patch.object(m.qa,'product_state',side_effect=[-1,-1,5,-1]),patch.object(m.qa,'require_pe_role'),patch.object(m,'ASSET',{'name':'fixed.msi','sha256':hashlib.sha256(b'msi').hexdigest(),'bytes':3}),contextlib.redirect_stdout(capture):
    code=m.main()
   result=json.loads(capture.getvalue().split(':',1)[1]);self.assertEqual(code,1 if changed else 0);self.assertEqual(result['byteIdentical'],not changed);self.assertTrue(result['uninstallConfirmed']);self.assertTrue(result['cleanupConfirmed']);self.assertFalse(result['v19MismatchFixed']);self.assertEqual(calls[-1],'uninstall');self.assertTrue(result['cleanupArmed']);self.assertEqual(result['installed']['sha256'],hashlib.sha256(installed).hexdigest())
   self.assertFalse(any(p.name in ('extracted','installed','fixture') for p in temp.rglob('*')))
 def test_owner_prefix_matches_actual_snapshot_guard_and_minimal_tools(self):
  source=Path(m.__file__).read_text();snapshot=(ROOT/'scripts/windows_upgrade_snapshot.ps1').read_text()
  self.assertIn("'axiom-installed-msi-byte-'+uuid.uuid4().hex",source)
  self.assertIn('StartsWith("$runner\\axiom-installed-"',snapshot)
  import ntpath
  runner=r'D:\a\_temp';good=ntpath.join(runner,'axiom-installed-msi-byte-'+'a'*32);bad=ntpath.join(runner,'v19-msi-byte-'+'a'*32)
  self.assertTrue(good.lower().startswith((runner+'\\axiom-installed-').lower()));self.assertFalse(bad.lower().startswith((runner+'\\axiom-installed-').lower()))
  self.assertNotIn('qa.runtime_tools()',source)
  self.assertIn("for name in ('msiexec.exe','pwsh.exe','git.exe'):",source)
  self.assertNotIn("'cargo.exe'",source);self.assertNotIn("'rustc.exe'",source);self.assertNotIn("'node.exe'",source)
 def test_minimal_tool_selection_records_exact_files_without_sdk_lookup(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);system=root/'System32';system.mkdir();files={}
   for name in ('msiexec.exe','pwsh.exe','git.exe','python.exe'):
    p=(system if name=='msiexec.exe' else root)/name;p.write_bytes(name.encode());files[name]=str(p)
   calls=[]
   def which(name):calls.append(name);return files.get(name)
   with patch.object(m.shutil,'which',side_effect=which),patch.object(m.sys,'executable',files['python.exe']),patch.dict(os.environ,{'SYSTEMROOT':str(root)}):
    tools,evidence=m.diagnostic_tools()
   self.assertEqual(calls,['msiexec.exe','pwsh.exe','git.exe']);self.assertEqual(set(tools),set(files));self.assertTrue(all(len(row['sha256'])==64 for row in evidence.values()))
 def test_identical_legacy_bytes_pass_only_baseline(self):self.case(False)
 def test_different_installed_bytes_are_retained_refused_and_cleaned(self):self.case(True)
if __name__=='__main__':unittest.main()
