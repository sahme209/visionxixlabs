"""Mock processes/pipes only: no signing, target execution or Security APIs."""
import sys,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import bounded_signing_tool as t
class Pipe:
 def __init__(self,n):self.n=n;self.closed=False
 def fileno(self):return self.n
 def close(self):self.closed=True
class Selector:
 def __init__(self):self.items={}
 def register(self,pipe,event,data):self.items[pipe]=SimpleNamespace(fileobj=pipe,data=data)
 def unregister(self,pipe):del self.items[pipe]
 def get_map(self):return self.items
 def select(self,seconds):return [(next(iter(self.items.values())),None)]if self.items else[]
 def close(self):pass
class Process:
 pid=12345
 def __init__(self):self.stdout=Pipe(101);self.stderr=Pipe(102);self.returncode=None;self.waits=[]
 def poll(self):return self.returncode
 def wait(self,timeout):self.waits.append(timeout);self.returncode=0;return 0
class Tests(unittest.TestCase):
 def run_mock(self,pieces,clock=None,stderr=b''):
  process=Process();buffers={101:bytearray(pieces),102:bytearray(stderr)}
  def read(fd,n):
   out=bytes(buffers[fd][:n]);del buffers[fd][:n];return out
  with patch.object(t.subprocess,'Popen',return_value=process)as spawn,patch.object(t.selectors,'DefaultSelector',Selector),patch.object(t.os,'set_blocking'),patch.object(t.os,'read',side_effect=read),patch.object(t.os,'killpg')as kill,patch.object(t.time,'monotonic',side_effect=clock or (lambda:0)):
   result=t.run(['/usr/bin/codesign'],'/private/tmp',{'LANG':'C'})
  return result,process,spawn,kill
 def test_success_caps_capture_not_signer_file_size(self):
  r,process,spawn,kill=self.run_mock(b'ok')
  self.assertEqual(r['output'],b'ok');self.assertEqual(r['state'],'completed')
  self.assertNotIn('preexec_fn',spawn.call_args.kwargs)
  self.assertTrue(spawn.call_args.kwargs['start_new_session']);kill.assert_not_called()
  self.assertTrue(process.stdout.closed and process.stderr.closed)
 def test_true_channels_and_elapsed_are_retained(self):
  r,process,spawn,kill=self.run_mock(b'OUT',stderr=b'ERR')
  self.assertEqual(r['stdout'],b'OUT');self.assertEqual(r['stderr'],b'ERR');self.assertEqual(r['output'],b'OUTERR')
  self.assertEqual(r['elapsed_seconds'],0)
 def test_output_overflow_is_bounded_and_stops_once(self):
  r,process,spawn,kill=self.run_mock(b'x'*65537)
  self.assertEqual(r['state'],'output_bound');self.assertEqual(len(r['output']),65536)
  kill.assert_called_once();self.assertEqual(process.waits,[5])
 def test_output_cap_is_shared_across_channels(self):
  r,process,spawn,kill=self.run_mock(b'a'*40000,stderr=b'b'*30000)
  self.assertEqual(r['state'],'output_bound');self.assertEqual(len(r['stdout'])+len(r['stderr']),65536);kill.assert_called_once()
 def test_late_success_is_refused_without_killing_reaped_group(self):
  r,process,spawn,kill=self.run_mock(b'ok',clock=iter([0,0,0,0,0,11]).__next__)
  self.assertEqual(r['state'],'timeout');self.assertEqual(r['elapsed_seconds'],11);kill.assert_not_called()
 def test_deadline_stops_owned_group_and_reaps(self):
  r,process,spawn,kill=self.run_mock(b'',clock=iter([0,11]).__next__)
  self.assertEqual(r['state'],'timeout');kill.assert_called_once();self.assertEqual(process.waits,[5])
class FailureTests(unittest.TestCase):
 def test_launch_error_does_not_leak_raw_text(self):
  with patch.object(t.subprocess,'Popen',side_effect=PermissionError('PRIVATE')):
   r=t.run(['/usr/bin/codesign'],'/private/tmp',{})
  self.assertEqual(r['state'],'unknown');self.assertEqual(r['error'],'PermissionError');self.assertNotIn('PRIVATE',str(r))
 def test_cleanup_timeout_is_unknown_and_not_retried(self):
  process=Process()
  with patch.object(t.subprocess,'Popen',return_value=process),patch.object(t.selectors,'DefaultSelector',Selector),patch.object(t.os,'set_blocking'),patch.object(t.time,'monotonic',side_effect=[0,11]),patch.object(t.os,'killpg')as kill,patch.object(process,'wait',side_effect=t.subprocess.TimeoutExpired('fixed',5))as wait:
   r=t.run(['/usr/bin/codesign'],'/private/tmp',{})
  self.assertEqual(r['state'],'unknown');self.assertEqual(r['cleanup'],'unknown');kill.assert_called_once();wait.assert_called_once_with(timeout=5)
if __name__=='__main__':unittest.main()
