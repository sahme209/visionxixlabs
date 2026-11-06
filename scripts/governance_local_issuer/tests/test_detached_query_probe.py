"""Mocked orchestration; never signs or loads a library."""
import sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import detached_query_probe as d
class Tests(unittest.TestCase):
 def test_sign_failure_stops_before_load(self):
  with patch.object(d,'command',return_value={'exit':1,'error':None,'bytes':0}),patch.object(d,'load_once')as load:
   with self.assertRaises(ValueError):d.sign_and_load({})
   load.assert_not_called()
 def test_verification_failure_stops_before_load(self):
  with patch.object(d,'command',side_effect=[{'exit':0,'error':None,'bytes':0},{'exit':1,'error':None,'bytes':0}]),patch.object(d,'load_once')as load:
   with self.assertRaises(ValueError):d.sign_and_load({})
   load.assert_not_called()
 def test_comparison_failure_stops_before_load(self):
  with patch.object(d,'command',return_value={'exit':0,'error':None,'bytes':0}),patch.object(d,'validate_signed',side_effect=ValueError('bad')),patch.object(d,'load_once')as load:
   with self.assertRaises(ValueError):d.sign_and_load({})
   load.assert_not_called()
 def test_once_ledger_on_unknown(self):
  with tempfile.TemporaryDirectory()as t:
   root=Path(t).resolve()
   with patch.object(d,'ROOT',root),patch.object(d,'verify'),patch.object(d,'sign_and_load',side_effect=ValueError('PRIVATE')):
    d.p.save(root/'packet.json',{})
    result=d.execute(root/'packet.json')
    self.assertEqual(result['status'],'unknown');self.assertNotIn('PRIVATE',str(result))
    with self.assertRaises(FileExistsError):d.execute(root/'packet.json')
class EnvironmentTests(unittest.TestCase):
 def test_signing_keeps_system_default_keychain_resolution(self):
  with tempfile.TemporaryDirectory()as t:
   root=Path(t).resolve();(root/'work').mkdir()
   with patch.object(d,'ROOT',root),patch.object(d.p.files.engine_tools,'_run_generation_child',return_value=(0,None))as run:
    d.command(['/usr/bin/codesign'],0)
   environment=run.call_args.args[2]
   self.assertNotIn('HOME',environment);self.assertNotIn('TMPDIR',environment)
   self.assertEqual(environment,{'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','LC_ALL':'C'})
 def test_runtime_keeps_disposable_home(self):
  with tempfile.TemporaryDirectory()as t:
   root=Path(t).resolve();(root/'work').mkdir()
   with patch.object(d,'ROOT',root),patch.object(d.p.files.engine_tools,'_run_generation_child',return_value=(0,None))as run:
    d.command(['/usr/bin/sandbox-exec'],'load')
   self.assertEqual(run.call_args.args[2]['HOME'],str(root/'work/home'))
class CurrentnessTests(unittest.TestCase):
 def test_comparison_hash_must_match_stable_binding(self):
  with tempfile.TemporaryDirectory()as t:
   root=Path(t).resolve();(root/'work').mkdir()
   (root/'work/command-2.log').write_text('Identifier='+d.IDENT+'\nTeamIdentifier=FG5N98FE6W\nCodeDirectory flags=0x10000(runtime)\n'+d.ENT.decode())
   binding={'sha256':'stable','size':1}
   comparison={'inputSha256':'other','inputSize':1,'derivedSha256':'stable','derivedSize':1}
   with patch.object(d,'ROOT',root),patch.object(d,'check_file',return_value=binding),patch.object(Path,'read_bytes',return_value=b'x'),patch.object(d.diff,'validate_derivative',return_value=comparison):
    with self.assertRaises(ValueError):d.validate_signed({})

 def test_final_copy_change_does_not_become_expectation(self):
  with tempfile.TemporaryDirectory()as t:
   root=Path(t).resolve();old={'path':'fixed','sha256':'compared'};new={'path':'fixed','sha256':'changed'}
   def verify(packet,node_after=None,copy_after=None):
    if copy_after is not None and copy_after!=new:raise ValueError('changed')
   with patch.object(d,'ROOT',root),patch.object(d,'verify',side_effect=verify),patch.object(d,'sign_and_load',return_value={'status':'module_load_observed','derivedCopy':old}),patch.object(d,'check_file',return_value=new):
    d.p.save(root/'packet.json',{});r=d.execute(root/'packet.json')
   self.assertEqual(r['status'],'unknown');self.assertEqual(r['derivedCopy'],old)
if __name__=='__main__':unittest.main()
