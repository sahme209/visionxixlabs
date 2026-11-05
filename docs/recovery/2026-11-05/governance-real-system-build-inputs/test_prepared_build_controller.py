"""Real prepared controller body; process, selector, signals and reads are mocked.

Only the test's owned temporary files are actually read/written. No child or
prepared driver/controller process is launched and no actual signal is sent.
"""
import hashlib,importlib.util,io,json,signal,subprocess,sys,tempfile,unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock,patch

class Pipe:
 def __init__(self,fd):self.fd=fd;self.closed=False
 def fileno(self):return self.fd
 def close(self):self.closed=True
class Selector:
 def __init__(self):self.entries={};self.closed=False
 def register(self,pipe,events,data):self.entries[pipe]=SimpleNamespace(fileobj=pipe,data=data)
 def get_map(self):return self.entries
 def select(self,timeout):return [(key,1)for key in list(self.entries.values())]
 def unregister(self,pipe):self.entries.pop(pipe)
 def close(self):self.closed=True

class PreparedControllerTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='axiom-controller-pure-',dir='/private/tmp');self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name);self.root.chmod(0o700)
  self.driver=self.root/'fixed-driver.py';self.driver.write_bytes(b'# INERT TEST INPUT, NEVER EXECUTED\n');self.driver.chmod(0o600)
  self.control=self.root/'control';self.capture=SimpleNamespace(buffer=io.BytesIO());self.selector=Selector()
  self.child=SimpleNamespace(pid=424242,returncode=None,stdout=Pipe(101),stderr=Pipe(102))
  self.child.wait=Mock(side_effect=self.reap)
  spec=importlib.util.spec_from_file_location('prepared_controller_under_mock',Path(__file__).with_name('prepared-build-controller.py'))
  self.module=importlib.util.module_from_spec(spec)
  with patch.object(sys,'dont_write_bytecode',True):spec.loader.exec_module(self.module)
  self.stack=ExitStack();self.addCleanup(self.stack.close)
  replacements={'DRIVER':self.driver,'DRIVER_SHA256':hashlib.sha256(self.driver.read_bytes()).hexdigest(),'CONTROL':self.control,'OUTPUT_BYTES':8}
  for name,value in replacements.items():self.stack.enter_context(patch.object(self.module,name,value))
  self.stack.enter_context(patch.object(self.module.sys,'argv',['prepared-controller']))
  self.stack.enter_context(patch.object(self.module.sys,'stdout',self.capture))
  self.stack.enter_context(patch.object(self.module.signal,'getsignal',return_value=signal.SIG_DFL))
  self.stack.enter_context(patch.object(self.module.time,'monotonic',return_value=0.0))
  self.popen=self.stack.enter_context(patch.object(self.module.subprocess,'Popen',return_value=self.child))
  self.stack.enter_context(patch.object(self.module.selectors,'DefaultSelector',return_value=self.selector))
  self.blocking=self.stack.enter_context(patch.object(self.module.os,'set_blocking'))
  self.kill=self.stack.enter_context(patch.object(self.module.os,'killpg'))
  self.read=self.stack.enter_context(patch.object(self.module.os,'read',return_value=b''))
 def reap(self,timeout):self.child.returncode=0;return 0
 def result(self):return json.loads((self.control/'result.json').read_text())
 def assert_closed(self):
  self.assertTrue(self.child.stdout.closed);self.assertTrue(self.child.stderr.closed);self.assertTrue(self.selector.closed)
  self.assertFalse(self.result()['executionAuthorized']);self.assertFalse(self.result()['retryAuthorized']);self.assertEqual(self.result()['descendantQuiescence'],'unavailable')
  self.popen.assert_called_once();self.assertTrue(self.popen.call_args.kwargs['start_new_session'])
 def test_output_bound_never_forwards_or_persists_overflow(self):
  self.read.return_value=b'12345678X'
  with self.assertRaisesRegex(RuntimeError,'stopped_no_retry'):self.module.main()
  self.assertEqual(self.capture.buffer.getvalue(),b'12345678');self.assertEqual((self.control/'stdout.log').read_bytes(),b'12345678')
  self.assertEqual(self.result()['bytes'],{'stdout':8,'stderr':0});self.assertEqual(self.result()['state'],'output_bound')
  self.read.assert_called_once_with(101,9);self.kill.assert_called_once_with(424242,signal.SIGKILL);self.assert_closed()
 def test_read_error_persists_terminal_evidence_and_kills_only_owned_unreaped_group(self):
  self.read.side_effect=OSError('SYNTHETIC READ FAILURE')
  with self.assertRaisesRegex(RuntimeError,'stopped_no_retry'):self.module.main()
  r=self.result();self.assertEqual(r['state'],'monitoring_or_launch_error');self.assertEqual(r['monitorErrorType'],'OSError')
  self.assertEqual(r['originalDriverCleanup'],'reaped_original_driver');self.assertEqual((self.control/'stdout.log').read_bytes(),b'');self.assertEqual((self.control/'stderr.log').read_bytes(),b'')
  self.kill.assert_called_once_with(self.child.pid,signal.SIGKILL);self.child.wait.assert_called_once_with(timeout=5);self.assert_closed()
 def test_reaped_child_is_never_signaled_after_wait(self):
  self.module.main();self.assertEqual(self.result()['state'],'completed');self.assertEqual(self.result()['driverExit'],0)
  self.assertEqual(self.result()['originalDriverCleanup'],'reaped_original_driver');self.kill.assert_not_called();self.child.wait.assert_called_once();self.assert_closed()
 def test_wait_timeout_retains_unknown_cleanup_without_success_or_retry(self):
  self.child.wait.side_effect=subprocess.TimeoutExpired('INERT MOCK CHILD',5)
  with self.assertRaisesRegex(RuntimeError,'stopped_no_retry'):self.module.main()
  r=self.result();self.assertEqual(r['state'],'wall_bound');self.assertIsNone(r['driverExit']);self.assertEqual(r['originalDriverCleanup'],'unknown');self.assertEqual(r['monitorErrorType'],'TimeoutExpired')
  self.assertEqual(self.child.wait.call_count,2);self.kill.assert_called_once_with(self.child.pid,signal.SIGKILL);self.assert_closed()
if __name__=='__main__':unittest.main()
