"""Pure/mock image inspection; no child, mount, statvfs or device operation."""
from pathlib import Path
import json,plistlib,sys,tempfile,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import image_inspection as i,container_assembly as a
class ImageInspectionTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory(dir='/private/tmp');self.addCleanup(self.t.cleanup);self.root=Path(self.t.name);self.root.chmod(0o700)
  self.image=self.root/'image/issuer-package.dmg';self.image.parent.mkdir(mode=0o700);self.image.write_bytes(b'FIXTURE IMAGE');self.image.chmod(0o600)
  self.stack=__import__('contextlib').ExitStack();self.addCleanup(self.stack.close);self.stack.enter_context(patch.object(i,'RUN_ROOT',self.root))
  self.identity={'stDev':7,'stIno':11,'readOnly':True};self.mount=self.root/'mount';self.package={'sourcePackage':'/private/tmp/FIXTURE-PACKAGE','sourceRevision':'a'*40,'packageDigest':'b'*64,'manifestSha256':'c'*64}
  self.attach=plistlib.dumps({'system-entities':[{'dev-entry':'/dev/disk9s1','mount-point':str(self.mount)}]})
  self.calls=[]
  def run(argv,seconds):
   self.calls.append(argv)
   return {'argv':argv,'state':'completed','exit':0,'stdout':self.attach if 'attach'in argv else b'','stderr':b'','cleanup':'reaped_original_child'}
  self.runner=self.stack.enter_context(patch.object(i,'_run',side_effect=run));self.identity_mock=self.stack.enter_context(patch.object(i,'_mount_identity',return_value=self.identity))
  self.namespace=self.stack.enter_context(patch.object(i,'_namespace_restored',return_value=True))
  self.content=self.stack.enter_context(patch.object(i,'_content',return_value={'qualification':'package_file_set_verified','packageDigest':'b'*64,'manifestSha256':'c'*64,'sourceRevision':'a'*40}))
 def inspect(self):return i.inspect_image(a.binding(self.image),self.package)
 def test_positive_exit_zero_single_readonly_mount_verified_and_detached_once(self):
  proof=self.inspect();self.assertEqual([x[1]for x in self.calls],['attach','detach']);self.assertEqual(self.calls[-1],['/usr/bin/hdiutil','detach','/dev/disk9s1'])
  p=json.loads(proof.read_text());self.assertEqual(p['state'],'content_verified_detached');self.assertFalse(p['possibleMountedImage']);self.assertFalse(p['executionAuthorized'])
  self.assertEqual(i.verify_recorded_inspection(a.binding(proof),a.binding(self.image),self.package)['state'],'content_verified_detached')
 def test_device_grammar_rejects_options_arbitrary_paths_and_oversized(self):
  for value in ('-force','/tmp/disk1','/dev/rdisk1','/dev/diskx','/dev/disk1\n','/dev/disk'+'1'*140):
   with self.subTest(value=value),self.assertRaises(ValueError):i._device(value)
 def test_ambiguous_or_nonzero_attach_never_speculatively_detaches(self):
  self.attach=plistlib.dumps({'system-entities':[{'dev-entry':'/dev/disk9s1','mount-point':str(self.mount)},{'dev-entry':'/dev/disk9s2','mount-point':'/other'}]})
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(len(self.calls),1)
 def test_reported_mount_without_changed_namespace_is_not_owned(self):
  def same(mount):
   s=mount.lstat();return {'stDev':s.st_dev,'stIno':s.st_ino,'readOnly':True}
  self.identity_mock.side_effect=same
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(len(self.calls),1)
 def test_nonzero_attach_never_detaches(self):
  self.runner.side_effect=lambda argv,seconds:{'argv':argv,'state':'completed','exit':1,'stdout':self.attach,'stderr':b'FAILED','cleanup':'reaped_original_child'}
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image)
 def test_known_owned_nonreadonly_mount_is_detached_but_never_accepted(self):
  self.identity['readOnly']=False
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertFalse(cm.exception.possible_mounted_image);self.assertEqual([x[1]for x in self.calls],['attach','detach'])
 def test_digest_mismatch_detaches_owned_mount_but_never_succeeds(self):
  self.content.return_value={'qualification':'package_file_set_verified','packageDigest':'0'*64,'manifestSha256':'c'*64,'sourceRevision':'a'*40}
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertFalse(cm.exception.possible_mounted_image);self.assertEqual([x[1]for x in self.calls],['attach','detach'])
 def test_ownership_loss_never_detaches_replacement(self):
  self.identity_mock.side_effect=[self.identity,{'stDev':8,'stIno':22,'readOnly':True}]
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(len(self.calls),1)
 def test_detach_timeout_retains_possible_mount_and_no_retry(self):
  original=self.runner.side_effect
  def run(argv,seconds):
   if 'detach'in argv:self.calls.append(argv);return {'argv':argv,'state':'timeout','exit':None,'stdout':b'','stderr':b'','cleanup':'unknown'}
   return original(argv,seconds)
  self.runner.side_effect=run
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual([x[1]for x in self.calls],['attach','detach'])
 def test_detach_exit_zero_without_namespace_restoration_is_unknown(self):
  self.namespace.return_value=False
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual([x[1]for x in self.calls],['attach','detach'])
 def test_image_mutation_after_successful_detach_never_returns_success_proof(self):
  original=self.runner.side_effect
  def run(argv,seconds):
   r=original(argv,seconds)
   if 'detach'in argv:self.image.write_bytes(b'CHANGED AFTER DETACH')
   return r
  self.runner.side_effect=run
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertFalse(cm.exception.possible_mounted_image)
 def test_attach_timeout_never_speculatively_detaches(self):
  self.runner.side_effect=lambda argv,seconds:{'argv':argv,'state':'timeout','exit':None,'stdout':b'','stderr':b'','cleanup':'unknown'}
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(self.runner.call_count,1)
 def test_same_run_is_never_replayed(self):
  self.inspect()
  with self.assertRaises(FileExistsError):self.inspect()
  self.assertEqual(len(self.calls),2)
 def test_image_mutation_before_detach_preserves_unknown_without_speculation(self):
  def content(*args):self.image.write_bytes(b'CHANGED');return {'qualification':'package_file_set_verified',**{k:self.package[k]for k in ('packageDigest','manifestSha256','sourceRevision')}}
  self.content.side_effect=content
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(len(self.calls),1)

class BoundedImageRunnerTests(unittest.TestCase):
 def exercise(self,timeout=False,overflow=False):
  from types import SimpleNamespace
  from unittest.mock import Mock
  import selectors,signal,subprocess
  class Pipe:
   def __init__(self,n):self.n=n
   def fileno(self):return self.n
   def close(self):pass
  class Selector:
   def __init__(self):self.entries={}
   def register(self,p,event,name):self.entries[p]=SimpleNamespace(fileobj=p,data=name)
   def get_map(self):return self.entries
   def select(self,t):return [(v,1)for v in list(self.entries.values())]
   def unregister(self,p):self.entries.pop(p)
   def close(self):pass
  child=SimpleNamespace(pid=424242,returncode=None,stdout=Pipe(101),stderr=Pipe(102));child.kill=Mock()
  def wait(timeout):child.returncode=0;return 0
  child.wait=Mock(side_effect=subprocess.TimeoutExpired('SYNTHETIC',1)if timeout else wait)
  with patch.object(i.subprocess,'Popen',return_value=child)as launch,patch.object(i.selectors,'DefaultSelector',return_value=Selector()),patch.object(i.os,'set_blocking'),patch.object(i.os,'read',return_value=b'12345678X'if overflow else b''),patch.object(i.os,'killpg')as no_signal,patch.object(i.time,'monotonic',return_value=0),patch.object(i.signal,'getsignal',return_value=signal.SIG_DFL),patch.object(i,'CAP',8):
   result=i._run(i._attach_argv(i.RUN_ROOT/'image/issuer-package.dmg'),90);no_signal.assert_not_called();launch.assert_called_once()
  return result,child
 def test_output_cap_kills_only_unreaped_mock_child_and_retains_no_overflow(self):
  r,p=self.exercise(overflow=True);self.assertEqual(r['stdout'],b'12345678');self.assertEqual(r['state'],'output_bound');p.kill.assert_called_once()
 def test_wait_reaped_child_is_never_killed(self):
  r,p=self.exercise();self.assertEqual(r['cleanup'],'reaped_original_child');p.kill.assert_not_called()
 def test_wait_timeout_preserves_unknown_without_replay(self):
  r,p=self.exercise(timeout=True);self.assertEqual(r['state'],'timeout');self.assertEqual(r['cleanup'],'unknown');p.kill.assert_called_once();self.assertEqual(p.wait.call_count,2)


class NamespaceReadbackTests(unittest.TestCase):
 def test_absent_or_exact_writable_original_namespace_only(self):
  from types import SimpleNamespace
  import stat
  path=Path('/private/tmp/SYNTHETIC-NO-QUERY')
  with patch.object(Path,'lstat',side_effect=FileNotFoundError):self.assertTrue(i._namespace_restored(path,{'stDev':7,'stIno':11}))
  record=SimpleNamespace(st_mode=stat.S_IFDIR|0o700,st_uid=i.os.getuid(),st_dev=7,st_ino=11)
  with patch.object(Path,'lstat',return_value=record),patch.object(i.os,'statvfs',return_value=SimpleNamespace(f_flag=0))as query:
   self.assertTrue(i._namespace_restored(path,{'stDev':7,'stIno':11}));query.assert_called_once()
  with patch.object(Path,'lstat',return_value=record),patch.object(i.os,'statvfs')as query:
   self.assertFalse(i._namespace_restored(path,{'stDev':8,'stIno':11}));query.assert_not_called()
  with patch.object(Path,'lstat',return_value=record),patch.object(i.os,'statvfs',return_value=SimpleNamespace(f_flag=i.os.ST_RDONLY)):
   self.assertFalse(i._namespace_restored(path,{'stDev':7,'stIno':11}))

if __name__=='__main__':unittest.main()
