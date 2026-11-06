"""State machine and policy tests; no Git or sandbox process execution."""
import sys,unittest,io,types
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import git_startup_probe as p
class StartupProbeTests(unittest.TestCase):
 def outcome(self,code=128,stderr=b"fatal: could not open '/dev/null' for reading and writing: Operation not permitted\n",stdout=b'',status='completed'):
  return {'status':status,'exit':code,'stdout':stdout,'stderr':stderr}
 def test_only_exact_denial_allows_control(self):
  for bad in (self.outcome(stderr=b'permission denied'),self.outcome(code=1),self.outcome(stdout=b'x'),self.outcome(status='unknown'),self.outcome(stderr=b'prefix '+self.outcome()['stderr']),self.outcome(stderr=self.outcome()['stderr']+b'\n')):
   with self.subTest(bad=bad):self.assertFalse(p.allow_control(bad))
  self.assertTrue(p.allow_control(self.outcome()))
 def test_nonmatching_or_uncertain_denial_never_invokes_control(self):
  for bad in (self.outcome(stderr=b'OTHER PRIVATE ERROR'),self.outcome(status='unknown')):
   calls=[]
   with patch.object(p,'verify_inputs'),patch.object(p,'run_revision',side_effect=lambda packet,control,deadline:(calls.append(control) or bad)):
    r=p.run_experiment({'sourceRevision':'a'*40})
   self.assertEqual(calls,[False]);self.assertEqual(r['status'],'unknown'if bad['status']=='unknown'else'prerequisite_unresolved');self.assertNotIn('PRIVATE',str(r))
 def test_exact_denial_and_fixed_revision_success_qualify_only_startup(self):
  calls=[];outcomes=iter([self.outcome(),self.outcome(code=0,stdout=b'a'*40+b'\n',stderr=b'')])
  with patch.object(p,'verify_inputs'),patch.object(p,'run_revision',side_effect=lambda packet,control,deadline:(calls.append(control) or next(outcomes))):r=p.run_experiment({'sourceRevision':'a'*40})
  self.assertEqual(calls,[False,True]);self.assertEqual(r['status'],'null_sink_startup_observed');self.assertFalse(r['governanceQualified'])
 def test_wrong_control_result_never_accepts_or_retries(self):
  calls=[];outcomes=iter([self.outcome(),self.outcome(code=0,stdout=b'WRONG\n',stderr=b'')])
  with patch.object(p,'verify_inputs'),patch.object(p,'run_revision',side_effect=lambda packet,control,deadline:(calls.append(control) or next(outcomes))):r=p.run_experiment({'sourceRevision':'a'*40})
  self.assertEqual(calls,[False,True]);self.assertEqual(r['status'],'prerequisite_unresolved')
 def test_changed_source_before_control_refuses_second_read(self):
  calls=[]
  with patch.object(p,'verify_inputs',side_effect=[None,ValueError('PRIVATE')]),patch.object(p,'run_revision',side_effect=lambda packet,control,deadline:(calls.append(control) or self.outcome())):
   with self.assertRaises(ValueError):p.run_experiment({'sourceRevision':'a'*40})
  self.assertEqual(calls,[False])
 def test_control_policy_adds_only_null_data_write(self):
  packet={'work':'/private/tmp/owned','repo':'/private/tmp/source'}
  deny=p.profile(packet,False);control=p.profile(packet,True)
  self.assertEqual(control,deny+'(allow file-write-data (literal "/dev/null"))')
  self.assertNotIn('(allow file-write* (literal "/dev/null"))',control)
 def test_nonmatching_denial_still_rechecks_inputs(self):
  observations=[]
  with patch.object(p,'verify_inputs',side_effect=lambda packet:observations.append('verified')),patch.object(p,'run_revision',return_value=self.outcome(stderr=b'OTHER')):
   r=p.run_experiment({'sourceRevision':'a'*40})
  self.assertEqual(observations,['verified','verified']);self.assertEqual(r['status'],'prerequisite_unresolved')
 def test_git_stays_in_outer_owned_process_group(self):
  captured=[]
  proc=types.SimpleNamespace(returncode=128,poll=lambda:128)
  def spawn(command,**kw):captured.append(kw);return proc
  with patch.object(p,'exclusive',side_effect=lambda path:io.BytesIO()),patch.object(p.os,'open',return_value=987),patch.object(p.os,'close'),patch.object(p.subprocess,'Popen',side_effect=spawn),patch.object(Path,'stat',return_value=types.SimpleNamespace(st_size=0)),patch.object(Path,'read_bytes',return_value=b''):
   p.run_revision({'work':'/synthetic','repo':'/synthetic/source','sourceRevision':'a'*40},False,999999999999)
  self.assertFalse(captured[0].get('start_new_session',False))
 def test_monitor_failure_cleans_direct_child_before_unknown_result(self):
  proc=types.SimpleNamespace(returncode=None,poll=lambda:None)
  cleanup=[]
  def stop(child,deadline):cleanup.append(child);child.returncode=-15;return True
  with patch.object(p,'exclusive',side_effect=lambda path:io.BytesIO()),patch.object(p.os,'open',return_value=987),patch.object(p.os,'close'),patch.object(p.subprocess,'Popen',return_value=proc),patch.object(Path,'stat',side_effect=OSError('PRIVATE')),patch.object(Path,'read_bytes',return_value=b''),patch.object(p,'_stop_owned',side_effect=stop):
   result=p.run_revision({'work':'/synthetic','repo':'/synthetic/source','sourceRevision':'a'*40},False,999999999999)
  self.assertEqual(result['status'],'unknown');self.assertEqual(result['exit'],-15);self.assertEqual(len(cleanup),1)
 def test_uncertain_inner_cleanup_holds_outer_owner_instead_of_exiting(self):
  proc=types.SimpleNamespace(returncode=None,poll=lambda:None)
  class HeldForOuter(Exception):pass
  with patch.object(p,'exclusive',side_effect=lambda path:io.BytesIO()),patch.object(p.os,'open',return_value=987),patch.object(p.os,'close'),patch.object(p.subprocess,'Popen',return_value=proc),patch.object(Path,'stat',side_effect=OSError('PRIVATE')),patch.object(p,'_stop_owned',return_value=False),patch.object(p,'_hold_for_outer_cleanup',side_effect=HeldForOuter):
   with self.assertRaises(HeldForOuter):p.run_revision({'work':'/synthetic','repo':'/synthetic/source','sourceRevision':'a'*40},False,999999999999)
 def test_interrupt_prevents_even_first_git_read(self):
  with patch.object(p,'verify_inputs'),patch.object(p,'_interrupted',True),patch.object(p,'run_revision')as run:
   with self.assertRaises(ValueError):p.run_experiment({'sourceRevision':'a'*40})
  run.assert_not_called()
if __name__=='__main__':unittest.main()
