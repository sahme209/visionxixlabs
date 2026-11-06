"""Actual supervisor/Git bodies; all process launches and null opens mocked."""
from pathlib import Path
import errno,io,os,sys,tempfile,types,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import stage_a_packet as a
e=a.engine_tools;b=a.builder
class ProcessIOTests(unittest.TestCase):
 def test_supervisor_readonly_eof_and_owned_close_on_success(self):
  process=types.SimpleNamespace(returncode=0,poll=lambda:0,wait=lambda **kw:0)
  def launch(*args,**kw):self.assertEqual(kw['stdin'],91);return process
  with tempfile.TemporaryFile()as log,patch.object(e.os,'open',return_value=91)as opened,patch.object(e.os,'close')as closed,patch.object(e.subprocess,'Popen',side_effect=launch):
   self.assertEqual(e._run_generation_child(['NEVER_EXECUTE'],Path('/synthetic'),{},log,1),(0,None))
  self.assertEqual(opened.call_args.args,('/dev/null',os.O_RDONLY|os.O_CLOEXEC|os.O_NOFOLLOW));closed.assert_called_once_with(91)
 def test_supervisor_launch_refusal_closes_and_sanitizes(self):
  with tempfile.TemporaryFile()as log,patch.object(e.os,'open',return_value=92),patch.object(e.os,'close')as closed,patch.object(e.subprocess,'Popen',side_effect=PermissionError(errno.EPERM,'SECRET /private/path')):
   with self.assertRaises(e.Unavailable)as caught:e._run_generation_child(['NEVER_EXECUTE'],Path('/synthetic'),{},log,1)
  closed.assert_called_once_with(92);self.assertEqual(caught.exception.launchDiagnostic,{'phase':'spawn','class':'OSError','errno':'EPERM'});self.assertNotIn('SECRET',str(caught.exception))
 def test_git_selected_stderr_is_separate_private_spool_and_stdout_intact(self):
  with tempfile.TemporaryDirectory(dir='/private/tmp')as tmp:
   Path(tmp).chmod(0o700);streams=[]
   def spool(**kw):self.assertEqual(kw,{'dir':tmp});stream=io.BytesIO();streams.append(stream);return stream
   def launch(*args,**kw):
    self.assertIsNot(kw['stdout'],kw['stderr']);self.assertNotEqual(kw['stderr'],b.subprocess.DEVNULL);kw['stdout'].write(b'ARCHIVE');kw['stderr'].write(b'DIAGNOSTIC');return types.SimpleNamespace(returncode=0)
   with patch.dict(os.environ,{'AXIOM_PRIVATE_GIT_SCRATCH':tmp},clear=True),patch.object(b.tempfile,'TemporaryFile',side_effect=spool),patch.object(b.subprocess,'run',side_effect=launch):self.assertEqual(b.git_bytes('/synthetic',['archive']),b'ARCHIVE')
   self.assertEqual(len(streams),2);self.assertTrue(all(s.closed for s in streams))
 def test_git_legacy_devnull_behavior_unchanged(self):
  def launch(*args,**kw):self.assertEqual(kw['stderr'],b.subprocess.DEVNULL);kw['stdout'].write(b'OLD');return types.SimpleNamespace(returncode=0)
  with patch.dict(os.environ,{},clear=True),patch.object(b.tempfile,'TemporaryFile',return_value=io.BytesIO())as spool,patch.object(b.subprocess,'run',side_effect=launch):self.assertEqual(b.git_bytes('/synthetic',['show']),b'OLD');self.assertEqual(spool.call_count,1)
 def test_git_launch_refusal_closes_spools_and_sanitizes(self):
  with tempfile.TemporaryDirectory(dir='/private/tmp')as tmp:
   Path(tmp).chmod(0o700);streams=[]
   def spool(**kw):stream=io.BytesIO();streams.append(stream);return stream
   with patch.dict(os.environ,{'AXIOM_PRIVATE_GIT_SCRATCH':tmp},clear=True),patch.object(b.tempfile,'TemporaryFile',side_effect=spool),patch.object(b.subprocess,'run',side_effect=OSError(errno.EACCES,'SECRET')):
    with self.assertRaises(b.Unavailable)as caught:b.git_bytes('/synthetic',['show'])
   self.assertTrue(all(s.closed for s in streams));self.assertEqual(caught.exception.launchDiagnostic,{'phase':'git_spawn','class':'OSError','errno':'EACCES'});self.assertNotIn('SECRET',str(caught.exception))

 def test_null_open_denial_never_launches_or_closes_unowned_fd(self):
  with tempfile.TemporaryFile()as log,patch.object(e.os,'open',side_effect=PermissionError(errno.EACCES,'SECRET')),patch.object(e.os,'close')as closed,patch.object(e.subprocess,'Popen')as child:
   with self.assertRaises(e.Unavailable)as caught:e._run_generation_child(['NEVER_EXECUTE'],Path('/synthetic'),{},log,1)
  closed.assert_not_called();child.assert_not_called();self.assertEqual(caught.exception.launchDiagnostic,{'phase':'null_input','class':'OSError','errno':'EACCES'})

 def test_close_uncertainty_after_launch_stops_and_reaps_owned_child(self):
  process=types.SimpleNamespace(returncode=None,pid=12345,poll=lambda:None)
  def wait(**kw):process.returncode=-9;return -9
  process.wait=unittest.mock.Mock(side_effect=wait)
  with tempfile.TemporaryFile()as log,patch.object(e.os,'open',return_value=93),patch.object(e.os,'close',side_effect=OSError(errno.EINTR,'SECRET'))as closed,patch.object(e.subprocess,'Popen',return_value=process),patch.object(e.os,'killpg')as kill:
   self.assertEqual(e._run_generation_child(['NEVER_EXECUTE'],Path('/synthetic'),{},log,1),(-9,'generation_parent_stdin_cleanup_unknown'))
  closed.assert_called_once_with(93);kill.assert_called_once();process.wait.assert_called_once_with(timeout=5)
 def test_failed_launch_and_close_uncertainty_never_signals_guessed_pid(self):
  with tempfile.TemporaryFile()as log,patch.object(e.os,'open',return_value=94),patch.object(e.os,'close',side_effect=OSError(errno.EINTR,'SECRET'))as closed,patch.object(e.subprocess,'Popen',side_effect=PermissionError(errno.EPERM,'SECRET')),patch.object(e.os,'killpg')as kill:
   with self.assertRaises(e.Unavailable)as caught:e._run_generation_child(['NEVER_EXECUTE'],Path('/synthetic'),{},log,1)
  closed.assert_called_once_with(94);kill.assert_not_called();self.assertEqual(caught.exception.parentInputCleanup,'unknown');self.assertEqual(caught.exception.launchDiagnostic['errno'],'EPERM')

 def test_git_preexec_exception_is_sanitized(self):
  with tempfile.TemporaryDirectory(dir='/private/tmp')as tmp:
   Path(tmp).chmod(0o700)
   with patch.dict(os.environ,{'AXIOM_PRIVATE_GIT_SCRATCH':tmp},clear=True),patch.object(b.tempfile,'TemporaryFile',side_effect=lambda **kw:io.BytesIO()),patch.object(b.subprocess,'run',side_effect=b.subprocess.SubprocessError('SECRET')):
    with self.assertRaises(b.Unavailable)as caught:b.git_bytes('/synthetic',['show'])
   self.assertEqual(caught.exception.launchDiagnostic,{'phase':'git_spawn','class':'SubprocessError','errno':'UNKNOWN'});self.assertNotIn('SECRET',str(caught.exception))

 def test_git_timeout_is_not_mislabeled_as_prelaunch_failure(self):
  timeout=b.subprocess.TimeoutExpired(['NEVER_EXECUTE'],60)
  with patch.dict(os.environ,{},clear=True),patch.object(b.tempfile,'TemporaryFile',return_value=io.BytesIO()),patch.object(b.subprocess,'run',side_effect=timeout):
   with self.assertRaises(b.subprocess.TimeoutExpired)as caught:b.git_bytes('/synthetic',['show'])
  self.assertIs(caught.exception,timeout);self.assertFalse(hasattr(caught.exception,'launchDiagnostic'))
