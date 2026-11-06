"""Actual Git helper with inert subprocess/temp-spool observations only."""
from pathlib import Path
import importlib.util,io,os,tempfile,types,unittest
from unittest.mock import patch
source=Path(__file__).parents[2]/'build-local-issuer-package-source.py'
spec=importlib.util.spec_from_file_location('artifact_git_scratch_builder',source);b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class ArtifactGitScratchTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='axiom-git-scratch-unit-',dir='/private/tmp');self.addCleanup(self.temp.cleanup);self.directory=Path(self.temp.name);self.directory.chmod(0o700)
 def run_fake(self,env,expected):
  def run(command,**kw):
   self.assertEqual(command[:2],['/usr/bin/sandbox-exec','-p']);self.assertEqual(command[3:6],['/usr/bin/git','-C','/synthetic/repo']);self.assertEqual(kw['env']['GIT_NO_LAZY_FETCH'],'1');kw['stdout'].write(b'SYNTHETIC GIT OUTPUT');return types.SimpleNamespace(returncode=0)
  with patch.dict(os.environ,env,clear=True),patch.object(b.tempfile,'TemporaryFile',side_effect=lambda **kw:io.BytesIO())as output,patch.object(b.subprocess,'run',side_effect=run)as child:
   self.assertEqual(b.git_bytes('/synthetic/repo',['show','a'*40+':package.json']),b'SYNTHETIC GIT OUTPUT');self.assertEqual(output.call_args.kwargs['dir'],expected);self.assertEqual(child.call_count,1)
 def test_absent_key_preserves_literal_legacy_location(self):self.run_fake({'TMPDIR':str(self.directory)},'/private/tmp')
 def test_present_key_selects_only_explicit_private_directory(self):self.run_fake({'AXIOM_PRIVATE_GIT_SCRATCH':str(self.directory)},str(self.directory))
 def test_invalid_selection_never_launches_or_falls_back(self):
  alias=self.directory/'alias';alias.symlink_to(self.directory,target_is_directory=True);wrong=self.directory/'wrong-mode';wrong.mkdir(mode=0o755);file=self.directory/'file';file.write_text('not directory')
  for value in ('','relative',str(self.directory/'missing'),str(alias),str(wrong),str(file),str(self.directory)+'/'):
   with self.subTest(value=value),patch.dict(os.environ,{'AXIOM_PRIVATE_GIT_SCRATCH':value},clear=True),patch.object(b.subprocess,'run')as child,patch.object(b.tempfile,'TemporaryFile')as output:
    self.assertRaises(b.Unavailable,b.git_bytes,'/synthetic/repo',['show','fixed']);child.assert_not_called();output.assert_not_called()
 def test_wrong_owner_refuses_without_execution(self):
  with patch.dict(os.environ,{'AXIOM_PRIVATE_GIT_SCRATCH':str(self.directory)},clear=True),patch.object(b.os,'getuid',return_value=os.getuid()+1),patch.object(b.subprocess,'run')as child:
   self.assertRaises(b.Unavailable,b.git_bytes,'/synthetic/repo',['show','fixed']);child.assert_not_called()
