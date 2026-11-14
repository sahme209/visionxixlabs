"""Pure mocked supervisor tests: no child/compiler/native/network is launched."""
import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('compile_supervisor',Path(__file__).parents[1]/'governance_linux_compile_supervisor.py')
supervisor=importlib.util.module_from_spec(spec)
spec.loader.exec_module(supervisor)

class Pipe:
    def __init__(self,fd):self.fd=fd;self.closed=False
    def fileno(self):return self.fd
    def close(self):self.closed=True
class Key:
    def __init__(self,fileobj,data):self.fileobj=fileobj;self.data=data
class Harness:
    def __init__(self,stdout=b'ok',stderr=b'warning',pending=False,exitcode=0,unknown=False):
        self.clock=0.;self.signal_handler=None;self.group_survives=False;self.signal_during_select=False;self.pending=pending;self.unknown=unknown;self.exitcode=exitcode;self.killed=False;self.reads={10:[stdout,b''],11:[stderr,b'']};self.active={};self.logs={101:bytearray(),102:bytearray()};self.proc=self;self.pid=444;self.stdout=Pipe(10);self.stderr=Pipe(11);self.returncode=None;self.spawn_kwargs=None
    def popen(self,argv,**kwargs):self.spawn_kwargs=kwargs;return self
    def poll(self):
        if self.killed:return -9
        if self.pending:return None
        return self.exitcode if not self.active else None
    def wait(self,timeout):
        if self.unknown:raise subprocess.TimeoutExpired('fixed',timeout)
        self.returncode=-9 if self.pending and self.killed else self.exitcode;return self.returncode
    def killpg(self,pid,sig):
        if sig==0:
            if self.group_survives:return
            raise ProcessLookupError()
        self.killed=True
    def sleep(self,seconds):self.clock+=seconds
    def set_signal(self,signum,handler):self.signal_handler=handler
    def monotonic(self):return self.clock
    def register(self,fileobj,events,data=None):self.active[fileobj.fileno()]=Key(fileobj,data)
    def unregister(self,fileobj):self.active.pop(fileobj.fileno(),None)
    def select(self,timeout):
        if self.signal_during_select:self.signal_handler(15,None)
        self.clock+=max(0.01,timeout)
        if self.pending:return []
        return [(key,1) for key in list(self.active.values())]
    def close(self):pass
    def read(self,fd,count):return self.reads[fd].pop(0)
    def write(self,fd,data):self.logs[fd].extend(data);return len(data)
    def run(self,**kwargs):
        with patch.object(supervisor.subprocess,'Popen',self.popen),patch.object(supervisor.selectors,'DefaultSelector',lambda:self),patch.object(supervisor.time,'monotonic',self.monotonic),patch.object(supervisor.time,'sleep',self.sleep),patch.object(supervisor.signal,'signal',self.set_signal),patch.object(supervisor.signal,'getsignal',return_value='previous-handler'),patch.object(supervisor.os,'killpg',self.killpg),patch.object(supervisor.os,'waitid',lambda *args:object() if not self.pending and not self.active else None,create=True),patch.object(supervisor.os,'P_PID',1,create=True),patch.object(supervisor.os,'WEXITED',4,create=True),patch.object(supervisor.os,'WNOWAIT',16,create=True),patch.object(supervisor.os,'read',self.read),patch.object(supervisor.os,'write',self.write),patch.object(supervisor.os,'set_blocking'),patch.object(supervisor.os,'open',side_effect=[101,102]),patch.object(supervisor.os,'close'):
            return supervisor.supervise(['/fixed/compiler','--fixed'],cwd=Path('/owned'),env={'PATH':'/usr/bin:/bin'},stdout_path=Path('/owned/stdout.log'),stderr_path=Path('/owned/stderr.log'),timeout_seconds=10,**kwargs)

class SupervisorTests(unittest.TestCase):
    def setUp(self):
        mocked=patch.object(supervisor.signal,'signal');mocked.start();self.addCleanup(mocked.stop)
        previous=patch.object(supervisor.signal,'getsignal',return_value='previous-handler');previous.start();self.addCleanup(previous.stop)
    def test_success_keeps_streams_separate_and_passes_no_ambient_environment(self):
        f=Harness();result=f.run();self.assertEqual(result['status'],'success');self.assertEqual(bytes(f.logs[101]),b'ok');self.assertEqual(bytes(f.logs[102]),b'warning');self.assertEqual(result['stdout_bytes'],2);self.assertEqual(result['stderr_bytes'],7);self.assertEqual(f.spawn_kwargs['env'],{'PATH':'/usr/bin:/bin'});self.assertIs(f.spawn_kwargs['shell'],False);self.assertTrue(f.spawn_kwargs['start_new_session']);self.assertTrue(f.spawn_kwargs['close_fds']);self.assertEqual(f.spawn_kwargs['stdin'],subprocess.DEVNULL)
    def test_nonzero_exit_retains_diagnostics_and_kills_owned_group(self):
        f=Harness(stderr=b'actual compiler error',exitcode=2);result=f.run();self.assertEqual(result['status'],'exit_nonzero');self.assertEqual(result['returncode'],2);self.assertEqual(bytes(f.logs[102]),b'actual compiler error');self.assertTrue(f.killed)
    def test_timeout_kills_group_and_waits_without_retry(self):
        f=Harness(pending=True);result=f.run();self.assertEqual(result['status'],'timeout');self.assertTrue(f.killed);self.assertTrue(result['cleanup_confirmed'])
    def test_aggregate_output_limit_bounds_both_logs(self):
        f=Harness(stdout=b'12345',stderr=b'67890');result=f.run(max_output_bytes=7);self.assertEqual(result['status'],'output_limit');self.assertEqual(sum(map(len,f.logs.values())),7);self.assertTrue(f.killed)
    def test_cleanup_timeout_is_explicit_unknown(self):
        f=Harness(pending=True,unknown=True);result=f.run();self.assertEqual(result['status'],'cleanup_unknown');self.assertFalse(result['cleanup_confirmed']);self.assertTrue(f.killed)
    def test_partial_log_writes_preserve_actual_output(self):
        f=Harness(stdout=b'abc',stderr=b'def');original=f.write
        def short(fd,data):return original(fd,data[:1])
        f.write=short;result=f.run();self.assertEqual(result['status'],'success');self.assertEqual(bytes(f.logs[101]),b'abc');self.assertEqual(bytes(f.logs[102]),b'def')
    def test_invalid_inputs_refuse_before_process_or_logs(self):
        for argv,env,timeout,cleanup,cap in [('shell string',{},1,1,1),(['relative'],{},1,1,1),(['/fixed'],None,1,1,1),(['/fixed'],{},0,1,1),(['/fixed'],{},1,6,1),(['/fixed'],{},1,1,0)]:
            with self.subTest(argv=argv,timeout=timeout),patch.object(supervisor.subprocess,'Popen') as spawn,patch.object(supervisor.os,'open') as opened:
                with self.assertRaises(ValueError):supervisor.supervise(argv,cwd='/owned',env=env,stdout_path=Path('/owned/a'),stderr_path=Path('/owned/b'),timeout_seconds=timeout,cleanup_seconds=cleanup,max_output_bytes=cap)
                spawn.assert_not_called();opened.assert_not_called()
    def test_spawn_failure_does_not_claim_a_compiler_exit(self):
        with patch.object(supervisor.subprocess,'Popen',side_effect=OSError('fixed unavailable')),patch.object(supervisor.os,'open',side_effect=[101,102]),patch.object(supervisor.os,'close'):
            result=supervisor.supervise(['/fixed/compiler'],cwd='/owned',env={},stdout_path=Path('/owned/a'),stderr_path=Path('/owned/b'),timeout_seconds=1)
        self.assertEqual(result['status'],'supervisor_error');self.assertIsNone(result['returncode'])


    def test_exact_output_cap_is_allowed_without_truncation(self):
        f=Harness(stdout=b'12345',stderr=b'67');result=f.run(max_output_bytes=7);self.assertEqual(result['status'],'success');self.assertEqual(sum(map(len,f.logs.values())),7)
    def test_zero_log_write_and_read_failure_stop_and_cleanup(self):
        f=Harness();f.write=lambda fd,data:0
        result=f.run();self.assertEqual(result['status'],'supervisor_error');self.assertTrue(f.killed)
        f=Harness()
        def bad_read(fd,count):raise OSError('mock read refused')
        f.read=bad_read;result=f.run();self.assertEqual(result['status'],'supervisor_error');self.assertTrue(f.killed)
    def test_logs_are_exclusive_nofollow_private_files(self):
        with patch.object(supervisor.subprocess,'Popen',side_effect=OSError('not started')),patch.object(supervisor.os,'open',side_effect=[101,102]) as opened,patch.object(supervisor.os,'close'):
            supervisor.supervise(['/fixed/compiler'],cwd='/owned',env={},stdout_path=Path('/owned/a'),stderr_path=Path('/owned/b'),timeout_seconds=1)
        for call in opened.call_args_list:
            self.assertEqual(call.args[1],supervisor.os.O_WRONLY|supervisor.os.O_CREAT|supervisor.os.O_EXCL|supervisor.os.O_NOFOLLOW);self.assertEqual(call.args[2],0o600)
    def test_nonfinite_limits_and_identical_log_paths_refuse_before_open(self):
        with patch.object(supervisor.os,'open') as opened:
            for timeout in [float('inf'),float('nan'),True]:
                with self.subTest(timeout=timeout),self.assertRaises(ValueError):supervisor.supervise(['/fixed'],cwd='/owned',env={},stdout_path='/owned/a',stderr_path='/owned/b',timeout_seconds=timeout)
            with self.assertRaises(ValueError):supervisor.supervise(['/fixed'],cwd='/owned',env={},stdout_path='/owned/a',stderr_path='/owned/a',timeout_seconds=1)
            opened.assert_not_called()


    def test_sigterm_during_capture_kills_group_reaps_and_restores_handler(self):
        f=Harness(pending=True);f.signal_during_select=True
        result=f.run();self.assertEqual(result['status'],'terminated');self.assertTrue(f.killed);self.assertTrue(result['cleanup_confirmed']);self.assertEqual(f.signal_handler,'previous-handler')
    def test_surviving_original_group_after_leader_wait_remains_cleanup_unknown(self):
        f=Harness();f.group_survives=True
        result=f.run();self.assertEqual(result['status'],'cleanup_unknown');self.assertFalse(result['cleanup_confirmed']);self.assertTrue(f.killed);self.assertLessEqual(f.clock,5.5)
    def test_group_probe_permission_refusal_is_unknown(self):
        f=Harness();original=f.killpg
        def denied(pid,sig):
            if sig==0:raise PermissionError('not proof of absence')
            original(pid,sig)
        f.killpg=denied;result=f.run();self.assertEqual(result['status'],'cleanup_unknown');self.assertFalse(result['cleanup_confirmed'])


    def test_sigterm_during_launch_is_deferred_until_child_ownership_is_returned(self):
        f=Harness(pending=True);original=f.popen
        def interrupted_launch(argv,**kwargs):
            f.signal_handler(15,None)
            return original(argv,**kwargs)
        f.popen=interrupted_launch
        result=f.run();self.assertTrue(f.stdout.closed);self.assertTrue(f.stderr.closed);self.assertEqual(result['status'],'terminated');self.assertTrue(f.killed);self.assertTrue(result['cleanup_confirmed']);self.assertEqual(f.signal_handler,'previous-handler')

if __name__=='__main__':unittest.main()
