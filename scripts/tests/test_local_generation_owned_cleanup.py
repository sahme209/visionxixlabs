"""Pure mocked child/process-group safety: no child or signal occurs."""
from pathlib import Path
import importlib.util,io,os,signal,sys,tempfile,unittest
from types import SimpleNamespace
from unittest.mock import Mock,patch
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('engine_cleanup_under_test',Path(__file__).parents[1]/'local_prisma_engine_inputs.py');e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
class OwnedCleanup(unittest.TestCase):
 def setUp(self):
  self.signal_patch=patch.object(e.os,'killpg');self.signal_patch.start();self.addCleanup(self.signal_patch.stop)
  self.child=SimpleNamespace(pid=424242,returncode=None)
  self.child.wait=Mock(side_effect=self.reap)
  self.file=tempfile.TemporaryFile();self.addCleanup(self.file.close)
 def reap(self,*a,**k):self.child.returncode=0;return 0
 def run_child(self,polls,times):
  def poll():
   result=next(polls)
   if result is not None:self.child.returncode=result
   return result
  self.child.poll=Mock(side_effect=poll)
  with patch.object(e.subprocess,'Popen',return_value=self.child),patch.object(e.os,'killpg')as kill,patch('time.monotonic',side_effect=times),patch('time.sleep'),patch('signal.getsignal',return_value=signal.SIG_DFL):
   result=e._run_generation_child(['inert'],Path('/private/tmp'),{},self.file,1)
   return result,kill.call_args_list
 def test_reaped_success_never_probes_or_signals_numeric_group(self):
  result,calls=self.run_child(iter([0]),iter([0]))
  self.assertEqual(result,(0,None));self.assertEqual(calls,[])
 def test_error_after_reap_never_signals_numeric_group(self):
  self.child.poll=Mock(side_effect=lambda:self.reap())
  with patch.object(e.subprocess,'Popen',return_value=self.child),patch.object(e.os,'killpg')as kill,patch('time.monotonic',return_value=0),patch('signal.getsignal',return_value=signal.SIG_DFL),patch.object(e.os,'fstat',side_effect=OSError('synthetic read error')):
   with self.assertRaises(OSError):e._run_generation_child(['inert'],Path('/private/tmp'),{},self.file,1)
   kill.assert_not_called()
 def test_timeout_signals_only_held_child_then_reaps(self):
  result,calls=self.run_child(iter([None]),iter([0,2]))
  self.assertEqual(result,(0,'generation_parent_wall_timeout'));self.assertEqual(len(calls),1);self.assertEqual(calls[0].args,(424242,signal.SIGKILL))
 def test_nondefault_reaping_refuses_before_spawn(self):
  with patch('signal.getsignal',return_value=signal.SIG_IGN),patch.object(e.subprocess,'Popen')as spawn:
   with self.assertRaises(RuntimeError):e._run_generation_child(['inert'],Path('/private/tmp'),{},self.file,1)
   spawn.assert_not_called()
 def test_cleanup_permission_error_is_not_retried(self):
  self.child.poll=Mock(return_value=None)
  with patch.object(e.subprocess,'Popen',return_value=self.child),patch.object(e.os,'killpg',side_effect=PermissionError('synthetic only'))as kill,patch('time.monotonic',side_effect=[0,2]),patch('signal.getsignal',return_value=signal.SIG_DFL):
   with self.assertRaises(PermissionError):e._run_generation_child(['inert'],Path('/private/tmp'),{},self.file,1)
   self.assertEqual(kill.call_count,1)
 def test_reap_timeout_returns_unknown_without_retry(self):
  import subprocess
  self.child.wait=Mock(side_effect=subprocess.TimeoutExpired('inert',5))
  result,calls=self.run_child(iter([None]),iter([0,2]))
  self.assertEqual(result,(None,'generation_original_child_cleanup_unknown'));self.assertEqual(len(calls),1)
if __name__=='__main__':unittest.main()
