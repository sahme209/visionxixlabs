"""Fully mocked child ownership/deadline tests; no process/network execution."""
import importlib.util,subprocess,types,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('bounded_collector',Path(__file__).parents[1]/'verify-local-prisma-engine-checksums.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Child:
 def __init__(self,first='timeout',cleanup='done'):self.pid=424242;self.returncode=None;self.waits=[];self.first=first;self.cleanup=cleanup
 def poll(self):return self.returncode
 def wait(self,timeout=None):
  self.waits.append(timeout)
  if len(self.waits)==1:
   if self.first=='interrupt':raise KeyboardInterrupt()
   raise subprocess.TimeoutExpired('fixed',22)
  if timeout is None:raise AssertionError('unbounded cleanup wait')
  if self.cleanup=='timeout':raise subprocess.TimeoutExpired('fixed',timeout)
  self.returncode=-9;return -9
class CleanupTests(unittest.TestCase):
 def test_timeout_cleanup_has_finite_wait(self):
  child=Child()
  with patch.object(m.subprocess,'Popen',return_value=child),patch.object(m.os,'killpg')as kill:r=m.collect_child(['fixed'],22)
  self.assertEqual(r,(None,'parent_wall_timeout'));self.assertEqual(child.waits,[22,5]);kill.assert_called_once_with(424242,m.signal.SIGKILL)
 def test_unknown_cleanup_does_not_wait_or_signal_again(self):
  child=Child(cleanup='timeout')
  with patch.object(m.subprocess,'Popen',return_value=child),patch.object(m.os,'killpg')as kill:r=m.collect_child(['fixed'],22)
  self.assertEqual(r,(None,'parent_worker_cleanup_unknown'));self.assertEqual(child.waits,[22,5]);self.assertEqual(kill.call_count,1)
 def test_interruption_cleans_original_before_propagating(self):
  child=Child(first='interrupt')
  with patch.object(m.subprocess,'Popen',return_value=child),patch.object(m.os,'killpg')as kill:
   with self.assertRaises(KeyboardInterrupt):m.collect_child(['fixed'],22)
  self.assertEqual(child.waits,[22,5]);self.assertEqual(kill.call_count,1)
 def test_process_lookup_race_still_reaps_original(self):
  child=Child()
  with patch.object(m.subprocess,'Popen',return_value=child),patch.object(m.os,'killpg',side_effect=ProcessLookupError):r=m.collect_child(['fixed'],22)
  self.assertEqual(r,(None,'parent_wall_timeout'));self.assertEqual(child.waits,[22,5])
if __name__=='__main__':unittest.main()
